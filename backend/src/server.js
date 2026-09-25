import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getPlaylistData, extractPlaylistId, extractVideoId, fetchVideoDescription } from './services/youtube.js';
import { SAMPLE_COURSES } from './data/sampleCourses.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = new Set(
  (process.env.FRONTEND_URL || 'https://youtubecourseify.vercel.app,http://localhost:5173')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
);
const requestCounts = new Map();

function isAllowedOrigin(origin) {
  return !origin || allowedOrigins.has(origin.replace(/\/$/, ''));
}

app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    if (!res.headersSent) res.status(504).json({ error: 'TIMEOUT', message: 'The request timed out.' });
  });
  next();
});

app.use('/api/playlist', (req, res, next) => {
  if (req.method !== 'POST' && req.method !== 'GET') return next();
  const key = req.ip || 'unknown';
  const now = Date.now();
  const recent = (requestCounts.get(key) || []).filter(timestamp => now - timestamp < 60000);
  if (recent.length >= 30) {
    return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many playlist requests. Try again shortly.' });
  }
  recent.push(now);
  requestCounts.set(key, recent);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'courseify-backend',
    timestamp: new Date().toISOString()
  });
});

// Fetch detailed description for a specific video ID
app.get('/api/video/:videoId/description', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) return res.status(400).json({ error: 'INVALID_ID' });

  try {
    const description = await fetchVideoDescription(videoId);
    res.json({ videoId, description });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_ERROR', description: '' });
  }
});

// Get list of preloaded sample courses
app.get('/api/sample-courses', (req, res) => {
  const list = Object.values(SAMPLE_COURSES).map(item => item.course);
  res.json({ courses: list });
});

// Fetch playlist by URL or ID (POST)
app.post('/api/playlist', async (req, res) => {
  const { url } = req.body || {};

  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({
      error: 'INVALID_URL',
      message: "That doesn't look like a YouTube link. Paste a link like youtube.com/playlist?list=… or a video link."
    });
  }
  if (url.length > 2048) {
    return res.status(400).json({ error: 'INVALID_URL', message: 'That URL is too long.' });
  }

  const playlistId = extractPlaylistId(url);
  const videoId = extractVideoId(url);
  if (!playlistId && !videoId) {
    return res.status(400).json({
      error: 'NO_PLAYLIST_ID',
      message: "This link has no playlist or video in it. Open the playlist on YouTube and copy its link."
    });
  }

  try {
    const data = await getPlaylistData(url);
    return res.json(data);
  } catch (err) {
    console.error('Error fetching playlist:', err.message);

    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'TIMEOUT', message: 'YouTube took too long to respond. Try again.' });
    }

    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: "We couldn't find this playlist. It may be private or deleted."
      });
    }

    if (err.message === 'QUOTA_EXCEEDED') {
      return res.status(429).json({
        error: 'QUOTA_EXCEEDED',
        message: "YouTube's daily limit has been reached. Try again tomorrow."
      });
    }

    if (err.message === 'EMPTY_PLAYLIST') {
      return res.status(422).json({
        error: 'EMPTY_PLAYLIST',
        message: "This playlist has no playable videos."
      });
    }

    return res.status(502).json({
      error: 'API_FAILURE',
      message: "Couldn't reach YouTube. Check your connection and try again."
    });
  }
});

// Fetch playlist by URL or ID (GET query)
app.get('/api/playlist', async (req, res) => {
  const { url, id } = req.query || {};
  const target = url || id;

  if (!target || typeof target !== 'string' || !target.trim()) {
    return res.status(400).json({
      error: 'INVALID_URL',
      message: "That doesn't look like a YouTube link. Paste a link like youtube.com/playlist?list=…"
    });
  }
  if (target.length > 2048) {
    return res.status(400).json({ error: 'INVALID_URL', message: 'That URL is too long.' });
  }

  const playlistId = extractPlaylistId(target);
  const videoId = extractVideoId(target);
  if (!playlistId && !videoId) {
    return res.status(400).json({
      error: 'NO_PLAYLIST_ID',
      message: "This link has no playlist or video in it. Open the playlist on YouTube and copy its link."
    });
  }

  try {
    const data = await getPlaylistData(target);
    return res.json(data);
  } catch (err) {
    console.error('Error fetching playlist:', err.message);

    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'TIMEOUT', message: 'YouTube took too long to respond. Try again.' });
    }

    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: "We couldn't find this playlist. It may be private or deleted."
      });
    }

    if (err.message === 'QUOTA_EXCEEDED') {
      return res.status(429).json({
        error: 'QUOTA_EXCEEDED',
        message: "YouTube's daily limit has been reached. Try again tomorrow."
      });
    }

    if (err.message === 'EMPTY_PLAYLIST') {
      return res.status(422).json({
        error: 'EMPTY_PLAYLIST',
        message: "This playlist has no playable videos."
      });
    }

    return res.status(502).json({
      error: 'API_FAILURE',
      message: "Couldn't reach YouTube. Check your connection and try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Courseify backend server listening on port ${PORT}`);
});
