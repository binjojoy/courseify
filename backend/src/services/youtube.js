import { parseISODuration, formatTime, formatDurationHuman } from '../utils/duration.js';
import { SAMPLE_COURSES } from '../data/sampleCourses.js';

const MAX_COURSE_VIDEOS = 200;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const PLAYLIST_CACHE_TTL_MS = 10 * 60 * 1000;
const PLAYLIST_CACHE_MAX_ENTRIES = 100;
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
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

/**
 * Extract YouTube playlist ID from any supported URL format or raw ID.
 * @param {string} input 
 * @returns {string|null}
 */
export function extractPlaylistId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // If already a playlist ID format (e.g. PL..., OLAK5uy_..., UU..., FL..., etc.)
  if (/^[a-zA-Z0-9_-]{12,}$/.test(trimmed) && (trimmed.startsWith('PL') || trimmed.startsWith('OL') || trimmed.startsWith('UU') || trimmed.startsWith('FL') || trimmed.startsWith('RD'))) {
    return trimmed;
  }

  try {
    const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const hostname = urlObj.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(hostname) && hostname !== 'youtu.be' && hostname !== 'www.youtu.be') return null;
    const listParam = urlObj.searchParams.get('list');
    if (listParam) return listParam;
    const channelId = urlObj.pathname.match(/^\/channel\/(UC[a-zA-Z0-9_-]{22})(?:\/videos)?\/?$/);
    if (YOUTUBE_HOSTS.has(hostname) && channelId) return `UU${channelId[1].slice(2)}`;
  } catch (e) {
    // Regex fallback
    const listMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (listMatch) return listMatch[1];
  }

  // Check sample IDs
  if (SAMPLE_COURSES[trimmed]) {
    return trimmed;
  }

  return null;
}

/**
 * Extract single video ID if given a single video link (e.g. watch?v=XYZ or youtu.be/XYZ)
 * @param {string} input
 * @returns {string|null}
 */
export function extractVideoId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  try {
    const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const hostname = urlObj.hostname.toLowerCase();
    if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
      const vid = urlObj.pathname.replace(/^\//, '');
      if (/^[a-zA-Z0-9_-]{11}$/.test(vid)) return vid;
    }
    if (YOUTUBE_HOSTS.has(hostname)) {
      const vParam = urlObj.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;
      const pathVideo = urlObj.pathname.match(/^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})(?:\/|$)/);
      if (pathVideo) return pathVideo[1];
    }
    return null;
  } catch (e) {}

  const match = trimmed.match(/(?:v=|youtu\.be\/|(?:embed|shorts|live)\/)([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  return null;
}

/**
 * Fetch detailed video description for a single video ID from its public watch page
 * @param {string} videoId
 * @returns {Promise<string>}
 */
export async function fetchVideoDescription(videoId) {
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return '';
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
    videoDescCache.set(videoId, desc);
    return desc;
  } catch (err) {
    console.warn(`Failed to fetch description for video ${videoId}:`, err.message);
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
      const details = playerResponse.videoDetails;
      if (details?.title) title = details.title;
      if (details?.author) channelTitle = details.author;
      if (!description && details?.shortDescription) description = details.shortDescription;
      durationSec = Number.parseInt(details?.lengthSeconds || '0', 10) || 0;
    } catch {}
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
    lastOpenedAt: new Date().toISOString()
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
  const course = {
    id: playlistId,
    title: plSnippet.title || 'Untitled Playlist',
    channelTitle: plSnippet.channelTitle || 'Unknown Channel',
    thumbnailUrl: plSnippet.thumbnails?.high?.url || plSnippet.thumbnails?.medium?.url || plSnippet.thumbnails?.default?.url || '',
    videoCount: plData.items[0].contentDetails?.itemCount || 0,
    totalDurationSec: 0,
    totalDurationFormatted: '0m',
    description: plSnippet.description || '',
    addedAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString()
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

  // Look for ytInitialData
  const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/s) || html.match(/var ytInitialData\s*=\s*({.+?});/);
  if (!match) {
    if (html.includes('This playlist is private') || html.includes('The playlist does not exist')) {
      throw new Error('NOT_FOUND');
    }
    throw new Error('API_FAILURE');
  }

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch (e) {
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
  rawItems = rawItems.slice(0, MAX_COURSE_VIDEOS);

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
    lastOpenedAt: new Date().toISOString()
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
      if (err.message === 'QUOTA_EXCEEDED' || err.message === 'API_FAILURE') {
        console.warn(JSON.stringify({ event: 'youtube_api_fallback', reason: err.message, playlistId }));
        try {
          return await scrapeYouTubePlaylist(playlistId);
        } catch (scraperErr) {
          throw err;
        }
      }
      throw err;
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
