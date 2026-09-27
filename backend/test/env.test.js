import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadBackendConfig, isAllowedOrigin } from '../src/config/env.js';

test('allows the scraper-only deployment configuration', () => {
  const messages = [];
  const config = loadBackendConfig({}, { info: message => messages.push(message), warn: message => messages.push(message) });
  assert.equal(config.port, 5000);
  assert.equal(config.youtubeApiKey, '');
  assert.ok(config.frontendUrls.includes('http://localhost:5173'));
  assert.ok(messages.some(message => message.includes('public_scraper_fallback')));
});

test('rejects invalid port and malformed frontend URLs', () => {
  assert.throws(() => loadBackendConfig({ PORT: '70000' }), /Invalid PORT/);
  assert.throws(() => loadBackendConfig({ FRONTEND_URL: 'not a URL' }), /Invalid FRONTEND_URL/);
});

test('ignores a malformed optional YouTube key and logs scraper fallback', () => {
  const messages = [];
  const config = loadBackendConfig({ YOUTUBE_API_KEY: 'short' }, { info: message => messages.push(message), warn: message => messages.push(message) });
  assert.equal(config.youtubeApiKey, '');
  assert.ok(messages.some(message => message.includes('scraper_fallback')));
});

test('warns when a secret is prefixed for the client bundle', () => {
  const messages = [];
  const config = loadBackendConfig(
    { VITE_YOUTUBE_API_KEY: 'would-be-published-to-every-visitor' },
    { info: message => messages.push(message), warn: message => messages.push(message) }
  );
  assert.equal(config.youtubeApiKey, '');
  assert.ok(messages.some(message => message.includes('client_exposed_secret_variable')));
});

test('allows exactly the configured origins and no suffix siblings', () => {
  const allowed = ['https://youtubecourseify.vercel.app', 'http://localhost:5173'];

  assert.equal(isAllowedOrigin('https://youtubecourseify.vercel.app', allowed), true);
  assert.equal(isAllowedOrigin('https://youtubecourseify.vercel.app/', allowed), true);
  assert.equal(isAllowedOrigin('http://localhost:5173', allowed), true);

  // Suffix/prefix neighbours an attacker can register on the same platform.
  assert.equal(isAllowedOrigin('https://evil.vercel.app', allowed), false);
  assert.equal(isAllowedOrigin('https://youtubecourseify.vercel.app.evil.com', allowed), false);
  assert.equal(isAllowedOrigin('https://evil.com/youtubecourseify.vercel.app', allowed), false);
  assert.equal(isAllowedOrigin('https://youtubecourseifyXvercelXapp', allowed), false);
  assert.equal(isAllowedOrigin('http://youtubecourseify.vercel.app', allowed), false, 'scheme must match');
  assert.equal(isAllowedOrigin('https://youtubecourseify.vercel.app:443', allowed), false, 'no implicit port normalisation');

  // Non-browser callers send no Origin and are handled by rate limiting.
  assert.equal(isAllowedOrigin(undefined, allowed), true);
  assert.equal(isAllowedOrigin(null, allowed), true);
  assert.equal(isAllowedOrigin('', allowed), true);
});