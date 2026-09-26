import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { extractPlaylistId, extractVideoId, getPlaylistData } from '../src/services/youtube.js';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.YOUTUBE_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = originalApiKey;
});

const jsonResponse = value => new Response(JSON.stringify(value), {
  headers: { 'Content-Type': 'application/json' }
});

test('extracts Shorts IDs and rejects non-YouTube hosts', () => {
  assert.equal(extractVideoId('https://www.youtube.com/shorts/abcdefghijk'), 'abcdefghijk');
  assert.equal(extractVideoId('https://youtube.com/live/abcdefghijk'), 'abcdefghijk');
  assert.equal(extractVideoId('https://youtube.example/watch?v=abcdefghijk'), null);
  assert.equal(extractPlaylistId('https://youtube.example/playlist?list=PL01234567890'), null);
  assert.equal(extractPlaylistId('https://www.youtube.com/channel/UC0123456789012345678901/videos'), 'UU0123456789012345678901');
});

test('caps API pagination at 200 and marks embed-restricted videos unavailable', async () => {
  process.env.YOUTUBE_API_KEY = 'test-api-key-at-least-twenty-chars';
  const requestedPages = [];
  let requestCount = 0;
  globalThis.fetch = async input => {
    requestCount += 1;
    const url = new URL(input);
    if (url.pathname.endsWith('/playlists')) {
      return jsonResponse({ items: [{
        snippet: { title: 'Test playlist', channelTitle: 'Test channel' },
        contentDetails: { itemCount: 250 }
      }] });
    }
    if (url.pathname.endsWith('/playlistItems')) {
      const pageToken = Number(url.searchParams.get('pageToken') || '0');
      requestedPages.push(pageToken);
      const firstIndex = pageToken * 50;
      const items = Array.from({ length: 50 }, (_, offset) => {
        const index = firstIndex + offset;
        const videoId = `v${String(index).padStart(10, '0')}`;
        return { snippet: { title: `Lesson ${index}`, resourceId: { videoId } }, contentDetails: { videoId } };
      });
      return jsonResponse({ items, nextPageToken: pageToken < 4 ? String(pageToken + 1) : undefined });
    }
    if (url.pathname.endsWith('/videos')) {
      const items = url.searchParams.get('id').split(',').map(id => ({
        id,
        snippet: { description: 'Test lesson' },
        contentDetails: { duration: 'PT2M' },
        status: { embeddable: id !== 'v0000000007', privacyStatus: 'public' }
      }));
      return jsonResponse({ items });
    }
    throw new Error(`Unexpected YouTube API URL: ${url}`);
  };

  const result = await getPlaylistData('https://www.youtube.com/playlist?list=PL01234567890');
  assert.equal(requestedPages.length, 4);
  assert.equal(result.videos.length, 200);
  assert.equal(result.course.videoCount, 199);
  assert.equal(result.videos[7].unavailable, true);
  assert.equal(result.course.totalDurationSec, 199 * 120);
  const initialRequestCount = requestCount;
  const cachedResult = await getPlaylistData('https://www.youtube.com/playlist?list=PL01234567890');
  assert.equal(requestCount, initialRequestCount);
  cachedResult.videos[0].title = 'caller mutation';
  const isolatedResult = await getPlaylistData('PL01234567890');
  assert.equal(isolatedResult.videos[0].title, 'Lesson 0');
});