const DEFAULT_FRONTEND_URLS = ['https://youtubecourseify.vercel.app', 'http://localhost:5173'];

/**
 * Exact-match CORS decision for a browser `Origin` header.
 *
 * There is deliberately no wildcard/suffix matching (for example `*.vercel.app`):
 * any third party could otherwise deploy a static site on a matching domain and
 * call this API from their page, burning the YouTube quota attached to this
 * service. Requests without an `Origin` header (curl, Postman, health probes)
 * are allowed through and are constrained by rate limiting instead.
 *
 * @param {string|null|undefined} origin
 * @param {Iterable<string>} allowedOrigins
 * @returns {boolean}
 */
export function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, '');
  for (const allowed of allowedOrigins) {
    if (allowed.replace(/\/$/, '') === normalized) return true;
  }
  return false;
}

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

  // A `VITE_`-prefixed variable is inlined into the client bundle by Vite, which
  // would publish the key to every visitor. Never read one, but warn loudly so
  // a mis-configured deployment is obvious instead of silently leaking.
  for (const name of Object.keys(env)) {
    if (/^VITE_.*(YOUTUBE|GEMINI|GOOGLE).*KEY$/i.test(name)) {
      logger.warn(JSON.stringify({ event: 'client_exposed_secret_variable', variable: name, action: 'ignored' }));
    }
  }

  return { port, frontendUrls, youtubeApiKey };
}