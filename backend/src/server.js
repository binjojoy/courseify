import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getPlaylistData, extractPlaylistId, extractVideoId, fetchVideoDescription } from './services/youtube.js';
import { SAMPLE_COURSES } from './data/sampleCourses.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const configuredFrontendOrigin = process.env.FRONTEND_URL?.replace(/\/$/, '');

function isAllowedOrigin(origin) {
  if (!origin || origin === configuredFrontendOrigin) return true;
  return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) || origin === 'http://localhost:5173';
}

app.use(cors({
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

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
