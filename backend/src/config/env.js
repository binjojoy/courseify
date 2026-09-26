const DEFAULT_FRONTEND_URLS = ['https://youtubecourseify.vercel.app', 'http://localhost:5173'];

export function loadBackendConfig(env = process.env, logger = console) {
  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid PORT: set an integer between 1 and 65535.');
  }

  const frontendUrls = (env.FRONTEND_URL || DEFAULT_FRONTEND_URLS.join(','))
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  for (const value of frontendUrls) {
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      throw new Error(`Invalid FRONTEND_URL entry "${value}": expected a full http(s) URL.`);
    }
  }

  let youtubeApiKey = env.YOUTUBE_API_KEY?.trim() || '';
  if (youtubeApiKey && youtubeApiKey.length < 20) {
    logger.warn(JSON.stringify({ event: 'invalid_environment', variable: 'YOUTUBE_API_KEY', action: 'scraper_fallback' }));
    youtubeApiKey = '';
  }
  if (!youtubeApiKey) {
    logger.info(JSON.stringify({ event: 'youtube_api_key_missing', action: 'public_scraper_fallback' }));
  }

  return { port, frontendUrls, youtubeApiKey };
}