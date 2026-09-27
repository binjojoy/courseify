import { parseISODuration, formatTime, formatDurationHuman } from '../utils/duration.js';
import { SAMPLE_COURSES } from '../data/sampleCourses.js';

const MAX_COURSE_VIDEOS = 200;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const SHORT_LINK_HOSTS = new Set(['youtu.be', 'www.youtu.be']);
export const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const PLAYLIST_ID_PATTERN = /^[a-zA-Z0-9_-]{8,}$/;
const RAW_PLAYLIST_ID_PATTERN = /^(?:PL|OL|UU|FL|RD|LL|LM)[a-zA-Z0-9_-]{6,}$/;
const PLAYLIST_CACHE_TTL_MS = 10 * 60 * 1000;
const PLAYLIST_CACHE_MAX_ENTRIES = 100;
const VIDEO_DESC_CACHE_MAX_ENTRIES = 200;
const playlistCache = new Map();
const playlistRequests = new Map();

function clonePlaylistResponse(data) {
  return structuredClone(data);
}

function cachePlaylistResponse(key, data) {
  playlistCache.delete(key);
  playlistCache.set(key, { expiresAt: Date.now() + PLAYLIST_CACHE_TTL_MS, data: clonePlaylistResponse(data) });
  while (playlistCache.size > PLAYLIST_CACHE_MAX_ENTRIES) {
    playlistCache.delete(playlistCache.keys().next().value);
  }
}

/**
 * In-memory LRU cache for fetched video descriptions to avoid repeated requests
 */
const videoDescCache = new Map();

function cacheVideoDescription(videoId, desc) {
  videoDescCache.delete(videoId);
  videoDescCache.set(videoId, desc);
  while (videoDescCache.size > VIDEO_DESC_CACHE_MAX_ENTRIES) {
    videoDescCache.delete(videoDescCache.keys().next().value);
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse colon formatted duration like "4:17:12" or "14:20" or "00:45"
 * @param {string} str 
 * @returns {number} duration in seconds
 */
export function parseFormattedDuration(str) {
  if (!str || typeof str !== 'string') return 0;
  const parts = str.trim().split(':').map(Number);
  if (parts.length > 3 || parts.some(part => !Number.isFinite(part) || part < 0)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

/**
 * Parse a user-supplied YouTube reference, but only when it resolves to an
 * allow-listed YouTube host.
 *
 * The outbound request target is always rebuilt from an extracted id
 * (`https://www.youtube.com/...`), so this is an input-validation boundary
 * rather than a URL proxy: non-YouTube hosts never yield an id.
 *
 * @param {string} input
 * @returns {URL|null}
 */
function parseYouTubeUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed || /[\s<>"'\\]/.test(trimmed)) return null;
  let urlObj;
  try {
    urlObj = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') return null;
  const hostname = urlObj.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(hostname) && !SHORT_LINK_HOSTS.has(hostname)) return null;
  return urlObj;
}

/**
 * Extract YouTube playlist ID from an allow-listed URL, a raw playlist id, or a
 * channel uploads URL. Returns null for anything else.
 * @param {string} input
 * @returns {string|null}
 */
export function extractPlaylistId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Bare ids: the sample catalogue plus the PL/OL/UU/FL/RD prefixes YouTube issues.
  if (SAMPLE_COURSES[trimmed]) return trimmed;
  if (RAW_PLAYLIST_ID_PATTERN.test(trimmed)) return trimmed;

  const urlObj = parseYouTubeUrl(trimmed);
  if (!urlObj) return null;

  const listParam = urlObj.searchParams.get('list');
  if (listParam && PLAYLIST_ID_PATTERN.test(listParam)) return listParam;

  const channelId = urlObj.pathname.match(/^\/channel\/(UC[a-zA-Z0-9_-]{22})(?:\/videos)?\/?$/);
  if (channelId) return `UU${channelId[1].slice(2)}`;

  return null;
}

/**
 * Extract a single video id from an allow-listed URL or a bare 11-character id.
 * @param {string} input
 * @returns {string|null}
 */
export function extractVideoId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed;

  const urlObj = parseYouTubeUrl(trimmed);
  if (!urlObj) return null;

  const hostname = urlObj.hostname.toLowerCase();
  if (SHORT_LINK_HOSTS.has(hostname)) {
    const shortId = urlObj.pathname.replace(/^\//, '').split('/')[0];
    return VIDEO_ID_PATTERN.test(shortId) ? shortId : null;
  }

  const vParam = urlObj.searchParams.get('v');
  if (vParam && VIDEO_ID_PATTERN.test(vParam)) return vParam;

  const pathVideo = urlObj.pathname.match(/^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})(?:\/|$)/);
  return pathVideo ? pathVideo[1] : null;
}

/**
 * Classify why YouTube refused to hand over metadata for a page.
 *
 * YouTube answers private / deleted / region-blocked playlists with HTTP 200 and
 * an error page, so the reason has to be read out of the body. Each mode gets
 * its own sentinel so the API layer can return an actionable message instead of
 * one generic "not found".
 *
 * @param {string} html
 * @returns {string} one of NOT_FOUND, PRIVATE, DELETED, REGION_BLOCKED, AGE_RESTRICTED, UNAVAILABLE
 */
function classifyYouTubePage(html) {
  const text = typeof html === 'string' ? html.slice(0, 200000) : '';
  if (!text) return 'NOT_FOUND';
  if (/is private\b/i.test(text)) return 'PRIVATE';
  if (/sign in to confirm your age|age[- ]restricted|inappropriate for some users/i.test(text)) return 'AGE_RESTRICTED';
  if (/(?:not|un)[\w\s]{0,40}?available in your country|blocked it in your country|copyright grounds/i.test(text)) return 'REGION_BLOCKED';
  if (/the playlist does not exist|has been removed|video unavailable|this video has been removed|account associated with this video has been terminated/i.test(text)) return 'DELETED';
  if (/this content isn't available|content is not available/i.test(text)) return 'UNAVAILABLE';
  return 'NOT_FOUND';
}

/**
 * Read the real playlist size out of the header, e.g. "1,204 videos".
 * Returns null when YouTube omits or reformats the string.
 *
 * @param {Record<string, unknown>|undefined} header playlistHeaderRenderer
 * @returns {number|null}
 */
export function parseDeclaredItemCount(header) {
  if (!header || typeof header !== 'object') return null;
  const node = header.numVideosText;
  if (!node || typeof node !== 'object') return null;
  const parts = [];
  if (typeof node.simpleText === 'string') parts.push(node.simpleText);
  if (Array.isArray(node.runs)) {
    for (const run of node.runs) {
      if (typeof run?.text === 'string') parts.push(run.text);
    }
  }
  const digits = parts.join('').replace(/[^\d]/g, '');
  return digits ? Number.parseInt(digits, 10) : null;
}

/**
 * Every sentinel this module throws. Anything else is an unexpected bug and is
 * reported to the client as a generic upstream failure.
 */
const UPSTREAM_SENTINELS = new Set([
  'TIMEOUT', 'QUOTA_EXCEEDED', 'RATE_LIMITED', 'PRIVATE', 'DELETED',
  'REGION_BLOCKED', 'AGE_RESTRICTED', 'UNAVAILABLE', 'NOT_FOUND',
  'EMPTY_PLAYLIST', 'INVALID_URL', 'API_FAILURE'
]);

/**
 * Sentinels that say nothing more than "the request did not work". They lose to
 * a specific reason when two upstream paths both fail.
 */
const GENERIC_SENTINELS = new Set(['API_FAILURE', 'NOT_FOUND', 'UNAVAILABLE']);

/**
 * Map the IFrame player response's playabilityStatus onto one of our sentinels.
 * Returns null when the video is playable.
 *
 * @param {{status?: string, reason?: string}|undefined} playabilityStatus
 * @returns {string|null}
 */
function classifyPlayabilityStatus(playabilityStatus) {
  const status = playabilityStatus?.status;
  if (!status || status === 'OK') return null;
  if (status === 'LOGIN_REQUIRED' || status === 'AGE_VERIFICATION_REQUIRED') return 'AGE_RESTRICTED';
  if (status === 'UNPLAYABLE' || status === 'LIVE_STREAM_OFFLINE') return 'UNAVAILABLE';
  if (status === 'CONTENT_CHECK_REQUIRED') return 'UNAVAILABLE';
  if (status === 'ERROR') {
    const reason = String(playabilityStatus?.reason || '');
    if (/private/i.test(reason)) return 'PRIVATE';
    if (/removed|terminated/i.test(reason)) return 'DELETED';
    if (/country|region/i.test(reason)) return 'REGION_BLOCKED';
    return 'UNAVAILABLE';
  }
  return 'UNAVAILABLE';
}

/**
 * Turn an upstream failure into a status/code/message triple.
 *
 * Only our own sentinel codes ever reach the client. Raw upstream error bodies
 * are never forwarded, so a query-string `key=` can never leak to a caller.
 *
 * @param {unknown} err
 * @returns {{status: number, error: string, message: string}}
 */
export function describeUpstreamError(err) {
  const code = err && typeof err.message === 'string' ? err.message : '';

  if (err?.name === 'AbortError' || code === 'TIMEOUT') {
    return { status: 504, error: 'TIMEOUT', message: 'YouTube took too long to respond. Try again in a moment.' };
  }
  if (code === 'QUOTA_EXCEEDED') {
    return { status: 429, error: 'QUOTA_EXCEEDED', message: "The YouTube API quota for today is used up. Try again tomorrow." };
  }
  if (code === 'RATE_LIMITED') {
    return { status: 429, error: 'RATE_LIMITED', message: 'Too many playlist requests from this network. Wait a minute and try again.' };
  }
  if (code === 'PRIVATE') {
    return { status: 404, error: 'PRIVATE', message: 'This playlist is private. Ask the owner to make it public or unlisted, then try again.' };
  }
  if (code === 'DELETED') {
    return { status: 404, error: 'DELETED', message: 'This playlist or video no longer exists on YouTube. It may have been deleted by its owner.' };
  }
  if (code === 'REGION_BLOCKED') {
    return { status: 451, error: 'REGION_BLOCKED', message: 'YouTube will not serve this content in your region, so Courseify cannot read it.' };
  }
  if (code === 'AGE_RESTRICTED') {
    return { status: 403, error: 'AGE_RESTRICTED', message: 'This content is age-restricted and cannot be imported without a signed-in YouTube session.' };
  }
  if (code === 'UNAVAILABLE') {
    return { status: 404, error: 'UNAVAILABLE', message: "YouTube would not serve this link. It may be private, deleted, or unavailable in your region." };
  }
  if (code === 'NOT_FOUND') {
    return { status: 404, error: 'NOT_FOUND', message: "We couldn't find this playlist. Check the link and make sure the playlist is public or unlisted." };
  }
  if (code === 'EMPTY_PLAYLIST') {
    return { status: 422, error: 'EMPTY_PLAYLIST', message: "This playlist has no playable videos. It may be empty, or every video in it is private." };
  }
  if (code === 'INVALID_URL') {
    return { status: 400, error: 'INVALID_URL', message: 'Only youtube.com, youtu.be and youtube-nocookie.com links can be imported.' };
  }
  return { status: 502, error: 'API_FAILURE', message: "Couldn't reach YouTube. Check your connection and try again." };
}

/**
 * Fetch detailed video description for a single video ID from its public watch page
 * @param {string} videoId
 * @returns {Promise<string>}
 */
export async function fetchVideoDescription(videoId) {
  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) return '';
  if (videoDescCache.has(videoId)) return videoDescCache.get(videoId);

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) return '';
    const html = await response.text();

    let desc = '';
    // Look for shortDescription marker
    const marker = '"shortDescription":"';
    const start = html.indexOf(marker);
    if (start !== -1) {
      const end = html.indexOf('","', start + marker.length);
      if (end !== -1) {
        const raw = html.substring(start + marker.length, end);
        try {
          desc = JSON.parse(`"${raw.replace(/"/g, '\\"')}"`);
        } catch {
          desc = raw.replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
      }
    }

    if (!desc) {
      // Fallback: meta description tag
      const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
      if (metaMatch) desc = metaMatch[1];
    }

    desc = (desc || '').substring(0, 4000);
    cacheVideoDescription(videoId, desc);
    return desc;
  } catch (err) {
    console.warn(JSON.stringify({ event: 'description_fetch_failed', videoId, reason: err?.message || String(err) }));
    return '';
  }
}

/**
 * Fetch and scrape single video info when a single YouTube video URL is supplied
 */
async function scrapeSingleVideo(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error('NOT_FOUND');
    throw new Error('API_FAILURE');
  }

  const html = await response.text();

  // YouTube serves an HTML error page with HTTP 200, so the body decides.
  const pageMode = classifyYouTubePage(html);
  if (pageMode !== 'NOT_FOUND') {
    throw new Error(pageMode);
  }

  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);
  const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/s) || html.match(/var ytInitialData\s*=\s*({.+?});/);
  
  let title = 'YouTube Video';
  let channelTitle = 'YouTube Creator';
  let description = '';
  let durationSec = 0;

  // Extract description via shortDescription or json
  const marker = '"shortDescription":"';
  const start = html.indexOf(marker);
  if (start !== -1) {
    const end = html.indexOf('","', start + marker.length);
    if (end !== -1) {
      const raw = html.substring(start + marker.length, end);
      try {
        description = JSON.parse(`"${raw.replace(/"/g, '\\"')}"`);
      } catch {
        description = raw.replace(/\\n/g, '\n');
      }
    }
  }

  if (match) {
    try {
      const data = JSON.parse(match[1]);
      const contents = data.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
      const primaryInfo = contents.find(c => c.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer;
      const secondaryInfo = contents.find(c => c.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer;

      if (primaryInfo?.title?.runs?.[0]?.text) {
        title = primaryInfo.title.runs[0].text;
      }
      if (secondaryInfo?.owner?.videoOwnerRenderer?.title?.runs?.[0]?.text) {
        channelTitle = secondaryInfo.owner.videoOwnerRenderer.title.runs[0].text;
      }
      if (!description && secondaryInfo?.attributedDescription?.content) {
        description = secondaryInfo.attributedDescription.content;
      }
    } catch (e) {}
  }

  if (playerResponseMatch) {
    try {
      const playerResponse = JSON.parse(playerResponseMatch[1]);
      const playMode = classifyPlayabilityStatus(playerResponse.playabilityStatus);
      if (playMode) throw new Error(playMode);
      const details = playerResponse.videoDetails;
      if (details?.title) title = details.title;
      if (details?.author) channelTitle = details.author;
      if (!description && details?.shortDescription) description = details.shortDescription;
      durationSec = Number.parseInt(details?.lengthSeconds || '0', 10) || 0;
    } catch (err) {
      if (err?.message && UPSTREAM_SENTINELS.has(err.message)) throw err;
    }
  }

  // Fallback title regex
  if (title === 'YouTube Video') {
    const titleMatch = html.match(/<title>(.+?) - YouTube<\/title>/);
    if (titleMatch) title = titleMatch[1];
  }

  const video = {
    videoId,
    position: 0,
    title,
    description: description.substring(0, 3000),
    durationSec,
    durationFormatted: durationSec ? formatTime(durationSec) : '00:00',
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    unavailable: false
  };

  const course = {
    id: `video_${videoId}`,
    title,
    channelTitle,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    videoCount: 1,
    totalDurationSec: durationSec,
    totalDurationFormatted: durationSec ? formatDurationHuman(durationSec) : 'Single Lesson',
    description: description.substring(0, 3000),
    addedAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
    truncated: false,
    totalItemCount: 1
  };

  return { course, videos: [video] };
}

/**
 * Fetch playlist via official YouTube Data API v3
 */
async function fetchViaYouTubeAPI(playlistId, apiKey) {
  // Step 1: playlists.list
  const playlistUrl = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${playlistId}&key=${apiKey}`;
  const plRes = await fetchWithTimeout(playlistUrl);
  if (!plRes.ok) {
    const errorBody = await plRes.json().catch(() => ({}));
    const reason = errorBody?.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded') {
      throw new Error('QUOTA_EXCEEDED');
    }
    if (plRes.status === 404 || errorBody?.error?.code === 404) {
      throw new Error('NOT_FOUND');
    }
    throw new Error('API_FAILURE');
  }

  const plData = await plRes.json();
  if (!plData.items || plData.items.length === 0) {
    throw new Error('NOT_FOUND');
  }

  const plSnippet = plData.items[0].snippet;
  const declaredItemCount = Number.isFinite(plData.items[0].contentDetails?.itemCount)
    ? plData.items[0].contentDetails.itemCount
    : null;
  const course = {
    id: playlistId,
    title: plSnippet.title || 'Untitled Playlist',
    channelTitle: plSnippet.channelTitle || 'Unknown Channel',
    thumbnailUrl: plSnippet.thumbnails?.high?.url || plSnippet.thumbnails?.medium?.url || plSnippet.thumbnails?.default?.url || '',
    videoCount: declaredItemCount || 0,
    totalDurationSec: 0,
    totalDurationFormatted: '0m',
    description: plSnippet.description || '',
    addedAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
    truncated: false,
    totalItemCount: declaredItemCount
  };

  // Step 2: playlistItems.list with pagination
  let allVideoItems = [];
  let nextPageToken = '';
  do {
    const pageSize = Math.min(50, MAX_COURSE_VIDEOS - allVideoItems.length);
    const params = new URLSearchParams({ part: 'snippet,contentDetails', maxResults: String(pageSize), playlistId, key: apiKey });
    if (nextPageToken) params.set('pageToken', nextPageToken);
    const itemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?${params}`;
    const itemsRes = await fetchWithTimeout(itemsUrl);
    if (!itemsRes.ok) {
      const body = await itemsRes.json().catch(() => ({}));
      if (body?.error?.errors?.[0]?.reason === 'quotaExceeded') throw new Error('QUOTA_EXCEEDED');
      throw new Error('API_FAILURE');
    }
    const itemsData = await itemsRes.json();
    if (itemsData.items) {
      allVideoItems.push(...itemsData.items.slice(0, pageSize));
    }
    nextPageToken = itemsData.nextPageToken;
  } while (nextPageToken && allVideoItems.length < MAX_COURSE_VIDEOS);

  if (allVideoItems.length === 0) {
    throw new Error('EMPTY_PLAYLIST');
  }

  // Step 3: videos.list in batches of 50 to get duration
  const videoIds = allVideoItems
    .map(item => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
    .filter(Boolean);

  const durationMap = {};
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({ part: 'contentDetails,snippet,status', id: batch.join(','), key: apiKey });
    const vUrl = `https://www.googleapis.com/youtube/v3/videos?${params}`;
    const vRes = await fetchWithTimeout(vUrl);
    if (vRes.ok) {
      const vData = await vRes.json();
      if (vData.items) {
        for (const item of vData.items) {
          const sec = parseISODuration(item.contentDetails?.duration);
          durationMap[item.id] = {
            durationSec: sec,
            durationFormatted: formatTime(sec),
            description: item.snippet?.description || '',
            embeddable: item.status?.embeddable !== false,
            privacyStatus: item.status?.privacyStatus || 'public'
          };
        }
      }
    } else {
      const body = await vRes.json().catch(() => ({}));
      if (body?.error?.errors?.[0]?.reason === 'quotaExceeded') throw new Error('QUOTA_EXCEEDED');
    }
  }

  let totalDurationSec = 0;
  const videos = [];
  let pos = 0;

  for (const item of allVideoItems) {
    const vId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
    if (!vId) continue;
    const title = item.snippet?.title || 'Untitled Video';
    const isUnavailable = title === 'Private video' || title === 'Deleted video' || !durationMap[vId] || !durationMap[vId].embeddable || durationMap[vId].privacyStatus === 'private';
    const durInfo = durationMap[vId] || { durationSec: 0, durationFormatted: '00:00', description: item.snippet?.description || '' };

    if (!isUnavailable) {
      totalDurationSec += durInfo.durationSec;
    }

    videos.push({
      videoId: vId,
      position: pos++,
      title,
      description: (durInfo.description || item.snippet?.description || '').substring(0, 3000),
      durationSec: durInfo.durationSec,
      durationFormatted: durInfo.durationFormatted,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
      unavailable: isUnavailable
    });
  }

  course.videoCount = videos.filter(video => !video.unavailable).length;
  course.totalDurationSec = totalDurationSec;
  course.totalDurationFormatted = formatDurationHuman(totalDurationSec);
  // Surface the cap instead of silently handing back a short playlist (E6).
  course.totalItemCount = declaredItemCount ?? videos.length;
  course.truncated = course.totalItemCount > videos.length;

  return { course, videos };
}

/**
 * Fetch and scrape YouTube playlist public page (handles both lockupViewModel and playlistVideoRenderer)
 */
async function scrapeYouTubePlaylist(playlistId) {
  const url = `https://www.youtube.com/playlist?list=${playlistId}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error('NOT_FOUND');
    throw new Error('API_FAILURE');
  }

  const html = await response.text();

  // YouTube answers private / deleted / blocked playlists with HTTP 200 and an
  // error page, so the reason has to come out of the body.
  const pageMode = classifyYouTubePage(html);
  if (pageMode !== 'NOT_FOUND') {
    throw new Error(pageMode);
  }

  // Look for ytInitialData
  const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/s) || html.match(/var ytInitialData\s*=\s*({.+?});/);
  if (!match) {
    throw new Error('API_FAILURE');
  }

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new Error('API_FAILURE');
  }

  // Extract metadata
  const header = data.header?.playlistHeaderRenderer;
  const title = header?.title?.simpleText ||
                header?.title?.runs?.[0]?.text ||
                data.metadata?.playlistMetadataRenderer?.title ||
                'YouTube Playlist';
  const channelTitle = header?.ownerText?.runs?.[0]?.text ||
                       header?.ownerText?.simpleText ||
                       'YouTube Creator';
  const description = header?.descriptionText?.simpleText ||
                      header?.descriptionText?.runs?.[0]?.text ||
                      '';
  const thumbnail = header?.playlistHeaderBanner?.thumbnails?.[0]?.url ||
                    data.microformat?.microformatDataRenderer?.thumbnail?.thumbnails?.[0]?.url ||
                    '';

  // Extract items from sectionListRenderer
  const tabs = data.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  let rawItems = [];

  for (const tab of tabs) {
    const contents = tab.tabRenderer?.content?.sectionListRenderer?.contents || [];
    for (const sec of contents) {
      const items = sec.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents ||
                    sec.itemSectionRenderer?.contents || [];
      if (items.length > 0) {
        rawItems = items;
        break;
      }
    }
    if (rawItems.length > 0) break;
  }

  if (rawItems.length === 0) {
    throw new Error('EMPTY_PLAYLIST');
  }

  // YouTube only ships the first page of items, but the header states the real
  // playlist size. Compare the two so a capped import is never silent.
  const declaredItemCount = parseDeclaredItemCount(header);
  const oversize = rawItems.length > MAX_COURSE_VIDEOS;
  rawItems = oversize ? rawItems.slice(0, MAX_COURSE_VIDEOS) : rawItems;

  let totalDurationSec = 0;
  const videos = [];
  let pos = 0;

  for (const item of rawItems) {
    // 1. YouTube modern UI format: lockupViewModel
    if (item.lockupViewModel) {
      const vm = item.lockupViewModel;
      const str = JSON.stringify(vm);
      const vMatch = str.match(/\/vi\/([a-zA-Z0-9_-]{11})\//) || str.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      const videoId = vMatch ? vMatch[1] : null;
      if (!videoId || videos.some(v => v.videoId === videoId)) continue;

      const vTitle = vm.metadata?.lockupMetadataViewModel?.title?.content || 'Untitled Video';
      const durText = vm.contentImage?.thumbnailViewModel?.overlays?.[0]
        ?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text || '00:00';
      const isUnavailable = vTitle === '[Private video]' || vTitle === '[Deleted video]';
      const lengthSec = parseFormattedDuration(durText);

      if (!isUnavailable) {
        totalDurationSec += lengthSec;
      }

      videos.push({
        videoId,
        position: pos++,
        title: vTitle,
        description: '',
        durationSec: lengthSec,
        durationFormatted: durText,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        unavailable: isUnavailable
      });
    }
    // 2. YouTube classic format: playlistVideoRenderer
    else if (item.playlistVideoRenderer) {
      const vr = item.playlistVideoRenderer;
      if (!vr || !vr.videoId || videos.some(v => v.videoId === vr.videoId)) continue;

      const vTitle = vr.title?.runs?.[0]?.text || vr.title?.simpleText || 'Untitled';
      const isUnavailable = vTitle === '[Private video]' || vTitle === '[Deleted video]';
      const lengthSec = parseInt(vr.lengthSeconds || '0', 10);
      const durFormatted = vr.lengthText?.simpleText || (lengthSec ? formatTime(lengthSec) : '00:00');

      if (!isUnavailable) {
        totalDurationSec += lengthSec;
      }

      videos.push({
        videoId: vr.videoId,
        position: pos++,
        title: vTitle,
        description: '',
        durationSec: lengthSec,
        durationFormatted: durFormatted,
        thumbnailUrl: vr.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`,
        unavailable: isUnavailable
      });
    }
  }

  if (videos.length === 0) {
    throw new Error('EMPTY_PLAYLIST');
  }

  // Preload first video description in background if empty
  if (videos[0]?.videoId) {
    fetchVideoDescription(videos[0].videoId).then(desc => {
      if (desc && videos[0]) videos[0].description = desc;
    }).catch(() => {});
  }

  const course = {
    id: playlistId,
    title,
    channelTitle,
    thumbnailUrl: thumbnail || videos[0]?.thumbnailUrl || '',
    videoCount: videos.filter(video => !video.unavailable).length,
    totalDurationSec,
    totalDurationFormatted: formatDurationHuman(totalDurationSec),
    description: description.substring(0, 3000),
    addedAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
    truncated: oversize || (declaredItemCount !== null && declaredItemCount > videos.length),
    totalItemCount: declaredItemCount ?? videos.length
  };

  return { course, videos };
}

/**
 * Main service method to retrieve playlist or single video data
 * @param {string} inputUrl 
 * @returns {Promise<{ course: object, videos: Array }>}
 */
async function fetchPlaylistData(inputUrl) {
  const playlistId = extractPlaylistId(inputUrl);

  if (!playlistId) {
    const singleVideoId = extractVideoId(inputUrl);
    if (singleVideoId) {
      return await scrapeSingleVideo(singleVideoId);
    }
    throw new Error('INVALID_URL');
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      return await fetchViaYouTubeAPI(playlistId, apiKey);
    } catch (err) {
      const reason = err?.message;
      if (reason !== 'QUOTA_EXCEEDED' && reason !== 'API_FAILURE') throw err;

      console.warn(JSON.stringify({ event: 'youtube_api_fallback', reason, playlistId }));
      let scraperReason;
      try {
        return await scrapeYouTubePlaylist(playlistId);
      } catch (scraperErr) {
        scraperReason = scraperErr?.message;
      }
      // Both paths failed. Prefer whichever explanation is more specific: a
      // private playlist is a 404, while a quota/transport error is a 429/502.
      const winner = GENERIC_SENTINELS.has(scraperReason) ? reason : scraperReason;
      throw new Error(winner || reason);
    }
  }

  return await scrapeYouTubePlaylist(playlistId);
}

function getPlaylistCacheKey(inputUrl) {
  const playlistId = extractPlaylistId(inputUrl);
  if (playlistId) return `playlist:${playlistId}`;
  const videoId = extractVideoId(inputUrl);
  return videoId ? `video:${videoId}` : null;
}

export async function getPlaylistData(inputUrl) {
  const key = getPlaylistCacheKey(inputUrl);
  if (!key) return fetchPlaylistData(inputUrl);

  const cached = playlistCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    playlistCache.delete(key);
    playlistCache.set(key, cached);
    return clonePlaylistResponse(cached.data);
  }
  if (cached) playlistCache.delete(key);

  const inFlight = playlistRequests.get(key);
  if (inFlight) return clonePlaylistResponse(await inFlight);

  const request = fetchPlaylistData(inputUrl)
    .then(data => {
      cachePlaylistResponse(key, data);
      return data;
    })
    .finally(() => playlistRequests.delete(key));
  playlistRequests.set(key, request);
  return clonePlaylistResponse(await request);
}
