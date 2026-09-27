import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getPlaylistData, extractPlaylistId, extractVideoId, fetchVideoDescription, describeUpstreamError, VIDEO_ID_PATTERN } from './services/youtube.js';
import { SAMPLE_COURSES } from './data/sampleCourses.js';
import { loadBackendConfig, isAllowedOrigin } from './config/env.js';

dotenv.config();

const app = express();
const { port: PORT, frontendUrls, youtubeApiKey } = loadBackendConfig();
if (youtubeApiKey) process.env.YOUTUBE_API_KEY = youtubeApiKey;
else delete process.env.YOUTUBE_API_KEY;
const allowedOrigins = new Set(frontendUrls);

const PLAYLIST_RATE_LIMIT = { windowMs: 60 * 1000, max: 30 };
const DESCRIPTION_RATE_LIMIT = { windowMs: 60 * 1000, max: 60 };
const MAX_TRACKED_CLIENTS = 5000;

/**
 * Minimal per-IP fixed-window rate limiter.
 *
 * This runs independently of CORS: a rejected origin still gets its request
 * executed server-side unless something stops it, and non-browser clients send
 * no `Origin` header at all. The bucket map is bounded and swept so an attacker
 * cycling source addresses cannot grow it without limit.
 */
function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();

  const sweep = () => {
    const now = Date.now();
    for (const [key, hits] of buckets) {
      const recent = hits.filter(timestamp => now - timestamp < windowMs);
      if (recent.length === 0) buckets.delete(key);
      else buckets.set(key, recent);
    }
  };

  const timer = setInterval(sweep, windowMs);
  timer.unref?.();

  const middleware = (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const recent = (buckets.get(key) || []).filter(timestamp => now - timestamp < windowMs);
    if (recent.length >= max) {
      if (!buckets.has(key)) buckets.set(key, recent);
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many playlist requests. Try again shortly.' });
    }
    recent.push(now);
    if (buckets.size >= MAX_TRACKED_CLIENTS && !buckets.has(key)) sweep();
    buckets.set(key, recent);
    next();
  };

  middleware.stop = () => clearInterval(timer);
  return middleware;
}

const playlistLimiter = createRateLimiter(PLAYLIST_RATE_LIMIT);
const descriptionLimiter = createRateLimiter(DESCRIPTION_RATE_LIMIT);

app.disable('x-powered-by');

/**
 * CORS only controls whether a browser hands the response to the calling page.
 * It does not stop the request from reaching this server, so a disallowed
 * browser origin is rejected outright and direct callers are rate limited.
 */
app.use('/api', (req, res, next) => {
  if (!isAllowedOrigin(req.headers.origin, allowedOrigins)) {
    return res.status(403).json({
      error: 'ORIGIN_NOT_ALLOWED',
      message: 'This origin is not allowed to use the Courseify API.'
    });
  }
  next();
});

app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin, allowedOrigins));
  },
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '8kb' }));
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    if (!res.headersSent) res.status(504).json({ error: 'TIMEOUT', message: 'The request timed out.' });
  });
  next();
});

app.use('/api/playlist', playlistLimiter);
app.use('/api/video', descriptionLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'courseify-backend',
    timestamp: new Date().toISOString()
  });
});

// Get list of preloaded sample courses
app.get('/api/sample-courses', (req, res) => {
  const list = Object.values(SAMPLE_COURSES).map(item => item.course);
  res.json({ courses: list });
});

const YOUTUBE_LINK_HINT = "Paste a link like youtube.com/playlist?list=… or a video link.";

function validateTarget(value, res) {
  if (!value || typeof value !== 'string' || !value.trim()) {
    res.status(400).json({ error: 'INVALID_URL', message: `That doesn't look like a YouTube link. ${YOUTUBE_LINK_HINT}` });
    return null;
  }
  if (value.length > 2048) {
    res.status(400).json({ error: 'INVALID_URL', message: 'That URL is too long. Paste just the playlist or video link.' });
    return null;
  }
  if (!extractPlaylistId(value) && !extractVideoId(value)) {
    res.status(400).json({
      error: 'NO_PLAYLIST_ID',
      message: `Courseify only reads youtube.com, youtu.be and youtube-nocookie.com links. ${YOUTUBE_LINK_HINT}`
    });
    return null;
  }
  return value.trim();
}

// Fetch detailed description for a specific video ID
app.get('/api/video/:videoId/description', async (req, res) => {
  const { videoId } = req.params;
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    return res.status(400).json({
      error: 'INVALID_ID',
      message: 'A YouTube video id is 11 characters of letters, numbers, dashes or underscores.'
    });
  }

  try {
    const description = await fetchVideoDescription(videoId);
    res.json({ videoId, description });
  } catch (err) {
    console.error(JSON.stringify({ event: 'video_description_failed', videoId, reason: err?.message || 'unknown' }));
    res.status(500).json({
      error: 'FETCH_ERROR',
      message: "Couldn't read this video's description right now.",
      description: ''
    });
  }
});

// Fetch playlist by URL or ID
async function handlePlaylistRequest(target, res) {
  try {
    const data = await getPlaylistData(target);
    return res.json(data);
  } catch (err) {
    const { status, error, message } = describeUpstreamError(err);
    if (status >= 500) {
      console.error(JSON.stringify({ event: 'playlist_fetch_failed', reason: error }));
    }
    return res.status(status).json({ error, message });
  }
}

app.post('/api/playlist', async (req, res) => {
  const target = validateTarget(req.body?.url, res);
  if (!target) return undefined;
  return handlePlaylistRequest(target, res);
});

app.get('/api/playlist', async (req, res) => {
  const target = validateTarget(req.query?.url || req.query?.id, res);
  if (!target) return undefined;
  return handlePlaylistRequest(target, res);
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Unknown API endpoint.' });
});

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature.
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'INVALID_URL', message: 'That request was too large. Paste just the playlist or video link.' });
  }
  console.error(JSON.stringify({ event: 'unhandled_request_error', reason: err?.message || 'unknown' }));
  if (res.headersSent) return undefined;
  return res.status(500).json({ error: 'API_FAILURE', message: "Couldn't reach YouTube. Check your connection and try again." });
});

const server = app.listen(PORT, () => {
  console.log(`Courseify backend server listening on port ${PORT}`);
});

const shutdown = () => {
  playlistLimiter.stop();
  descriptionLimiter.stop();
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
