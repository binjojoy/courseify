import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  extractPlaylistId, extractVideoId, getPlaylistData,
  describeUpstreamError, parseDeclaredItemCount, parseFormattedDuration
} from '../src/services/youtube.js';

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.YOUTUBE_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = originalApiKey;
});

const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

const textResponse = (body, status = 200) => new Response(body, { status });

test('extracts Shorts IDs and rejects non-YouTube hosts', () => {
  assert.equal(extractVideoId('https://www.youtube.com/shorts/abcdefghijk'), 'abcdefghijk');
  assert.equal(extractVideoId('https://youtube.com/live/abcdefghijk'), 'abcdefghijk');
  assert.equal(extractVideoId('https://youtube.example/watch?v=abcdefghijk'), null);
  assert.equal(extractPlaylistId('https://youtube.example/playlist?list=PL01234567890'), null);
  assert.equal(extractPlaylistId('https://www.youtube.com/channel/UC0123456789012345678901/videos'), 'UU0123456789012345678901');
});

test('only extracts ids from allow-listed YouTube hosts (S5 input validation)', () => {
  // Playlist ids and video ids are never pulled out of look-alike hosts, and
  // userinfo/embedded-credential tricks cannot smuggle a host past the check.
  assert.equal(extractPlaylistId('https://youtube.com.attacker.test/playlist?list=PL01234567890'), null);
  assert.equal(extractPlaylistId('https://attacker.test/youtube.com/playlist?list=PL01234567890'), null);
  assert.equal(extractPlaylistId('https://www.youtube.com@attacker.test/playlist?list=PL01234567890'), null);
  assert.equal(extractPlaylistId('javascript:alert(1)//?list=PL01234567890'), null);
  assert.equal(extractPlaylistId('file:///etc/passwd'), null);
  assert.equal(extractVideoId('https://attacker.test/watch?v=abcdefghijk'), null);
  assert.equal(extractVideoId('//attacker.test/watch?v=abcdefghijk'), null);
  // A schemeless paste is completed to https, so this is still youtube.com.
  assert.equal(extractVideoId('//youtube.com/watch?v=abcdefghijk'), 'abcdefghijk');

  // Genuine inputs still resolve, with and without a scheme.
  assert.equal(extractPlaylistId('youtube.com/playlist?list=PL01234567890'), 'PL01234567890');
  assert.equal(extractPlaylistId('https://m.youtube.com/playlist?list=PL01234567890'), 'PL01234567890');
  assert.equal(extractPlaylistId('https://www.youtube-nocookie.com/playlist?list=PL01234567890'), 'PL01234567890');
  assert.equal(extractVideoId('youtu.be/abcdefghijk'), 'abcdefghijk');
  assert.equal(extractVideoId('https://www.youtube.com/embed/abcdefghijk'), 'abcdefghijk');
  assert.equal(extractVideoId('abcdefghijk'), 'abcdefghijk');
  assert.equal(extractVideoId('   https://youtu.be/abcdefghijk   '), 'abcdefghijk');

  // Wrong arity / junk is rejected rather than truncated into a fake id.
  assert.equal(extractVideoId('abcdefghij'), null, '10 chars is not a video id');
  assert.equal(extractVideoId('abcdefghijkl'), null, '12 chars is not a video id');
  assert.equal(extractVideoId('abcdefghijk!'), null);
  assert.equal(extractVideoId(''), null);
  assert.equal(extractVideoId(null), null);
  assert.equal(extractPlaylistId('  '), null);
  assert.equal(extractPlaylistId(undefined), null);
});

test('never throws a URL containing the API key back to the caller (S2)', async () => {
  const secret = 'super-secret-api-key-value-1234';
  process.env.YOUTUBE_API_KEY = secret;
  const seenUpstream = [];
  globalThis.fetch = async input => {
    const url = new URL(input);
    seenUpstream.push(url.searchParams.get('key'));
    if (url.pathname.endsWith('/playlists')) {
      return jsonResponse({ error: { code: 403, errors: [{ reason: 'keyInvalid', message: `bad key ${secret}` }] } }, 403);
    }
    // The scraper fallback also fails, and its body echoes the key back.
    return textResponse(`<html>upstream rejected ${secret}</html>`, 200);
  };

  const failure = await getPlaylistData('PLnope1234567').then(
    () => null,
    err => err
  );
  assert.ok(failure, 'an upstream failure must reject');

  const described = describeUpstreamError(failure);
  assert.equal(described.error, 'API_FAILURE');
  assert.equal(described.status, 502);
  assert.ok(seenUpstream.includes(secret), 'the key was sent upstream as expected');
  assert.ok(!JSON.stringify(described).includes(secret), 'response body must not echo the key');
  assert.ok(!String(failure.message).includes(secret), 'thrown message must not echo the key');
});

test('maps every upstream sentinel to a status, code and message', () => {
  const cases = [
    ['TIMEOUT', 504], ['QUOTA_EXCEEDED', 429], ['RATE_LIMITED', 429],
    ['PRIVATE', 404], ['DELETED', 404], ['REGION_BLOCKED', 451],
    ['AGE_RESTRICTED', 403], ['UNAVAILABLE', 404], ['NOT_FOUND', 404],
    ['EMPTY_PLAYLIST', 422], ['INVALID_URL', 400]
  ];
  for (const [sentinel, status] of cases) {
    const described = describeUpstreamError(new Error(sentinel));
    assert.equal(described.error, sentinel, `${sentinel} keeps its code`);
    assert.equal(described.status, status, `${sentinel} status`);
    assert.ok(described.message.length > 10, `${sentinel} has an actionable message`);
  }

  // An AbortError is the shape fetchWithTimeout produces on timeout.
  const aborted = new Error('The operation was aborted');
  aborted.name = 'AbortError';
  assert.equal(describeUpstreamError(aborted).error, 'TIMEOUT');

  // Anything unexpected degrades to a generic 502 rather than leaking internals.
  const unknown = describeUpstreamError(new TypeError('Cannot read properties of undefined'));
  assert.equal(unknown.error, 'API_FAILURE');
  assert.equal(unknown.status, 502);
  assert.equal(describeUpstreamError(undefined).status, 502);
});

test('classifies private, deleted and region-blocked playlists from a 200 body', async () => {
  // YouTube answers these with HTTP 200 and an error page, so the reason can
  // only be read out of the body.
  const pages = {
    PRIVATE: 'This playlist is private. To view this playlist, please sign in.',
    DELETED: 'The playlist does not exist.',
    REGION_BLOCKED: 'Watch on YouTube. The uploader has not made this video available in your country.',
    AGE_RESTRICTED: 'Sign in to confirm your age. This video may be inappropriate for some users.',
    UNAVAILABLE: "This content isn't available"
  };

  for (const [expected, body] of Object.entries(pages)) {
    globalThis.fetch = async () => textResponse(body, 200);
    const failure = await getPlaylistData(`PL${expected}00000`).then(
      () => null,
      err => err
    );
    assert.ok(failure, `${expected} must reject`);
    assert.equal(describeUpstreamError(failure).error, expected, `body for ${expected}`);
  }

  // A real HTTP 404 is a 404, not a generic failure.
  globalThis.fetch = async () => textResponse('<html>gone</html>', 404);
  const missing = await getPlaylistData('PLmissing0000001').then(() => null, err => err);
  assert.equal(describeUpstreamError(missing).error, 'NOT_FOUND');

  // A parseable playlist with nothing in it is 422, not 404.
  const emptyHtml = `<html><script>var ytInitialData = ${JSON.stringify({
    header: { playlistHeaderRenderer: { title: { simpleText: 'Empty' } } },
    contents: { twoColumnBrowseResultsRenderer: { tabs: [] } }
  })};</script></html>`;
  globalThis.fetch = async () => textResponse(emptyHtml, 200);
  const empty = await getPlaylistData('PLempty00000001').then(() => null, err => err);
  assert.equal(describeUpstreamError(empty).error, 'EMPTY_PLAYLIST');
});

test('rejects a non-YouTube link before any upstream request is made', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return textResponse('', 200); };
  const failure = await getPlaylistData('https://youtube.example/playlist?list=PL01234567890').then(
    () => null,
    err => err
  );
  assert.equal(describeUpstreamError(failure).error, 'INVALID_URL');
  assert.equal(describeUpstreamError(failure).status, 400);
  assert.equal(called, false, 'an invalid link must never reach the network');
});

test('reports the real playlist size instead of truncating silently (E6)', () => {
  assert.equal(parseDeclaredItemCount({ numVideosText: { simpleText: '1,204 videos' } }), 1204);
  assert.equal(parseDeclaredItemCount({ numVideosText: { runs: [{ text: '250' }] } }), 250);
  assert.equal(parseDeclaredItemCount({ numVideosText: { simpleText: '1 video' } }), 1);
  assert.equal(parseDeclaredItemCount({ numVideosText: {} }), null);
  assert.equal(parseDeclaredItemCount({}), null);
  assert.equal(parseDeclaredItemCount(undefined), null);
  assert.equal(parseDeclaredItemCount(null), null);
});

test('flags a truncated playlist in the scraper path', async () => {
  const items = Array.from({ length: 260 }, (_, index) => ({
    playlistVideoRenderer: {
      videoId: `v${String(index).padStart(10, '0')}`,
      title: { runs: [{ text: `Lesson ${index}` }] },
      lengthSeconds: '120'
    }
  }));
  const html = `<html><script>var ytInitialData = ${JSON.stringify({
    header: { playlistHeaderRenderer: { title: { simpleText: 'Huge' }, numVideosText: { simpleText: '1,204 videos' } } },
    contents: { twoColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: { content: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: [{ playlistVideoListRenderer: { contents: items } }] } }] } } } }] } }
  })};</script></html>`;

  globalThis.fetch = async () => textResponse(html, 200);
  const result = await getPlaylistData('https://www.youtube.com/playlist?list=PLtruncated0001');
  assert.equal(result.videos.length, 200);
  assert.equal(result.course.truncated, true);
  assert.equal(result.course.totalItemCount, 1204);
  assert.equal(result.course.videoCount, 200);
});

test('flags truncation in the API path and never reports it when complete', async () => {
  process.env.YOUTUBE_API_KEY = 'test-api-key-at-least-twenty-chars';
  const buildItems = (firstIndex, count) => Array.from({ length: count }, (_, offset) => {
    const index = firstIndex + offset;
    const videoId = `v${String(index).padStart(10, '0')}`;
    return {
      snippet: { title: `Lesson ${index}`, resourceId: { videoId } },
      contentDetails: { videoId }
    };
  });

  const serveItems = itemCount => async input => {
    const url = new URL(input);
    if (url.pathname.endsWith('/playlists')) {
      return jsonResponse({ items: [{ snippet: { title: 'T', channelTitle: 'C' }, contentDetails: { itemCount } }] });
    }
    if (url.pathname.endsWith('/playlistItems')) {
      const pageToken = Number(url.searchParams.get('pageToken') || '0');
      const pageSize = Number(url.searchParams.get('maxResults'));
      const next = (pageToken + 1) * 50;
      return jsonResponse({
        items: buildItems(pageToken * 50, pageSize),
        nextPageToken: next < itemCount ? String(pageToken + 1) : undefined
      });
    }
    return jsonResponse({
      items: url.searchParams.get('id').split(',').map(id => ({
        id, snippet: { description: '' }, contentDetails: { duration: 'PT1M' }, status: { embeddable: true, privacyStatus: 'public' }
      }))
    });
  };

  globalThis.fetch = serveItems(250);
  const capped = await getPlaylistData('https://www.youtube.com/playlist?list=PLcapped000000001');
  assert.equal(capped.videos.length, 200);
  assert.equal(capped.course.totalItemCount, 250);
  assert.equal(capped.course.truncated, true, '250 items reported, 200 delivered');

  // Same fixture with an honest itemCount must not claim truncation.
  globalThis.fetch = serveItems(50);
  const complete = await getPlaylistData('https://www.youtube.com/playlist?list=PLcomplete000001');
  assert.equal(complete.videos.length, 50);
  assert.equal(complete.course.truncated, false);
  assert.equal(complete.course.totalItemCount, 50);
});

test('parses colon durations without producing NaN', () => {
  assert.equal(parseFormattedDuration('4:17:12'), 15432);
  assert.equal(parseFormattedDuration('14:20'), 860);
  assert.equal(parseFormattedDuration('00:45'), 45);
  assert.equal(parseFormattedDuration('1:00:00:00'), 0, 'four segments is not a duration');
  assert.equal(parseFormattedDuration('LIVE'), 0);
  assert.equal(parseFormattedDuration(''), 0);
  assert.equal(parseFormattedDuration(null), 0);
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
  assert.equal(result.course.totalItemCount, 250);
  assert.equal(result.course.truncated, true);
  const initialRequestCount = requestCount;
  const cachedResult = await getPlaylistData('https://www.youtube.com/playlist?list=PL01234567890');
  assert.equal(requestCount, initialRequestCount);
  cachedResult.videos[0].title = 'caller mutation';
  const isolatedResult = await getPlaylistData('PL01234567890');
  assert.equal(isolatedResult.videos[0].title, 'Lesson 0');
});