import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadBackendConfig } from '../src/config/env.js';

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