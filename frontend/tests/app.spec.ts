import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
// Imported rather than hardcoded: seeding the wrong version here would pop the
// release-notes modal over every test and fail them for the wrong reason.
import { APP_VERSION } from '../src/config/app';

const course = {
  id: 'course-test',
  title: 'Inspectable Course',
  channelTitle: 'Courseify Test Channel',
  thumbnailUrl: '',
  videoCount: 2,
  totalDurationSec: 120,
  totalDurationFormatted: '2m',
  addedAt: new Date().toISOString(),
  lastOpenedAt: new Date().toISOString(),
  source: { type: 'playlist', id: 'PL12345678901', url: 'https://www.youtube.com/playlist?list=PL12345678901' }
};

const videos = [
  { videoId: 'abc12345678', position: 0, title: 'First lesson', description: '', durationSec: 60, durationFormatted: '01:00', thumbnailUrl: '' },
  { videoId: 'def12345678', position: 1, title: 'Second lesson', description: '', durationSec: 60, durationFormatted: '01:00', thumbnailUrl: '' }
];

/**
 * Material Symbols renders as a ligature font. Until the webfont arrives the
 * browser lays the icon *name* out as text ("local_fire_department"), which is
 * far wider than the glyph and briefly overflows the layout. Any assertion that
 * measures horizontal fit has to wait for font loading first, otherwise it
 * fails on a cold cache for a reason that has nothing to do with the CSS.
 */
async function waitForFonts(page: Page) {
  // Bounded: `document.fonts.ready` also settles when a font request fails, but
  // a slow or blocked font host must not be able to eat the whole test timeout.
  await page.evaluate(() => Promise.race([
    document.fonts.ready,
    new Promise<void>(resolve => setTimeout(resolve, 5000))
  ]));
  // One frame so the reflow triggered by the swap is committed to the DOM.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
}

async function seedCourse(page: Page) {
  await page.addInitScript(({ courseData, videoData, version }) => {
    localStorage.setItem('courseify:last-seen-release', version);
    localStorage.setItem('courseify:v1:courses', JSON.stringify([courseData]));
    localStorage.setItem(`courseify:v1:course:${courseData.id}:videos`, JSON.stringify(videoData));
    localStorage.setItem(`courseify:v1:course:${courseData.id}:progress`, JSON.stringify({ lastVideoId: videoData[0].videoId, updatedAt: new Date().toISOString(), completedAt: null, videos: {} }));
  }, { courseData: course, videoData: videos, version: APP_VERSION });
}

/**
 * Switch to a tab in the course workspace, if this viewport has the tab strip.
 *
 * The strip is `display:none` on wide viewports, where the panels sit side by
 * side instead, so the click is conditional by design. `locator.isVisible()`
 * does not wait for anything, though, and the strip mounts a tick or two after
 * the route changes — a bare `if (await tab.isVisible())` therefore silently
 * skipped the click on a slow paint, and the test failed moments later waiting
 * for content that was one click away. Waiting for the workspace to mount first
 * makes the visibility check reliable, and the click itself still auto-waits.
 *
 * The lookup is scoped to the workspace tablist on purpose: the AI study guide
 * has its own tablist with the same tab names ("Notes", "Flashcards"), so an
 * unscoped `getByRole('tab', { name: 'Flashcards' })` matches twice once the AI
 * panel is open on a narrow viewport.
 *
 * `fallbackListName` covers the desktop layout, where the strip is hidden and
 * the same panels are reached through the AI study guide's own tablist.
 */
async function openWorkspaceTab(page: Page, name: string, fallbackListName?: string) {
  await page.getByTestId('course-player').waitFor({ state: 'visible' });
  const workspaceTab = page
    .getByRole('tablist', { name: 'Course workspace' })
    .getByRole('tab', { name, exact: true });
  if (await workspaceTab.isVisible()) {
    await workspaceTab.click();
    return;
  }
  if (!fallbackListName) return;
  const fallbackTab = page
    .getByRole('tablist', { name: fallbackListName })
    .getByRole('tab', { name, exact: true });
  if (await fallbackTab.isVisible()) await fallbackTab.click();
}

test('add-course form exposes invalid URL state', async ({ page }) => {
  await page.addInitScript(version => localStorage.setItem('courseify:last-seen-release', version), APP_VERSION);
  await page.goto('/#/add');
  await expect(page.getByTestId('add-course-page')).toBeVisible();
  await page.getByTestId('playlist-url-input').fill('https://example.com/not-a-youtube-source');
  await page.getByTestId('import-playlist-button').click();
  await expect(page.getByRole('alert')).toContainText('valid YouTube');
});

test('deep course lesson routes restore the real player structure', async ({ page }) => {
  await seedCourse(page);
  await page.goto('/#/course/course-test/lesson/def12345678');
  await expect(page.getByTestId('course-player')).toBeVisible();
  await expect(page.getByTestId('current-lesson-title')).toHaveText('Second lesson');
  await expect(page.locator('[data-testid="playlist-sidebar"]:visible')).toBeVisible();
  await expect(page.locator('[data-testid="lesson-item"]:visible').nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('progressbar', { name: 'Course completion' })).toHaveAttribute('aria-valuenow', '0');
  await openWorkspaceTab(page, 'Notes');
  await page.getByRole('button', { name: /click to add note/i }).click();
  await expect(page.getByTestId('notes-editor')).toBeVisible();
});

test('dashboard exposes seeded course state on mobile', async ({ page }) => {
  await seedCourse(page);
  await page.goto('/#/dashboard');
  await expect(page.getByTestId('dashboard')).toBeVisible();
  await expect(page.getByTestId('course-card')).toContainText('Inspectable Course');
  await waitForFonts(page);
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await expect(page.getByRole('progressbar', { name: 'Inspectable Course completion' }).first()).toBeVisible();
});

test('command palette navigates lessons and Gemini key settings persist locally', async ({ page }) => {
  await seedCourse(page);
  await page.addInitScript(() => {
    (window as any).__geminiTestHeader = '';
    (window as any).__geminiTestUrl = '';
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
      if (url.includes('generativelanguage.googleapis.com')) {
        (window as any).__geminiTestUrl = url;
        (window as any).__geminiTestHeader = new Headers(init?.headers).get('x-goog-api-key');
        if ((window as any).__geminiTestHeader === 'bad-key') {
          return Promise.resolve(new Response(JSON.stringify({ error: { message: 'API key not valid.' } }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        return Promise.resolve(new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
          usageMetadata: { totalTokenCount: 12 }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return nativeFetch(input, init);
    };
  });
  await page.goto('/#/course/course-test');
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await palette.getByRole('textbox', { name: 'Search commands and lessons' }).fill('Second lesson');
  await palette.getByRole('option', { name: /Second lesson/ }).click();
  await expect(page.getByTestId('current-lesson-title')).toHaveText('Second lesson');

  await page.getByRole('button', { name: 'Configure Gemini API key' }).click();
  const keyDialog = page.getByRole('dialog', { name: 'Gemini API key' });
  await expect(keyDialog.getByText(/No key is saved yet/)).toBeVisible();
  const dialogBounds = await keyDialog.boundingBox();
  const viewportHeight = await page.evaluate(() => window.visualViewport?.height || window.innerHeight);
  expect(dialogBounds).not.toBeNull();
  expect(Math.abs((dialogBounds!.y + dialogBounds!.height / 2) - viewportHeight / 2)).toBeLessThan(20);
  await keyDialog.getByRole('textbox', { name: 'API key' }).fill('AIzaSyCourseifyTestKey');
  await keyDialog.getByRole('button', { name: 'Save key' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('courseify:gemini-api-key'))).toBe('AIzaSyCourseifyTestKey');
  const configuredButton = page.getByRole('button', { name: /Update Gemini API key/ });
  await expect(configuredButton).toBeVisible();
  await configuredButton.click();
  const savedKeyDialog = page.getByRole('dialog', { name: 'Gemini API key' });
  await expect(savedKeyDialog.getByText(/A key is saved in this browser/)).toBeVisible();
  await savedKeyDialog.getByRole('button', { name: 'Test key' }).click();
  await expect(savedKeyDialog.getByRole('status')).toContainText('Gemini replied: Hello');
  await expect(page.getByRole('button', { name: /12 tokens used by this key/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__geminiTestHeader)).toBe('AIzaSyCourseifyTestKey');
  await expect.poll(() => page.evaluate(() => (window as any).__geminiTestUrl)).toContain('gemini-3.8-flash');
  await savedKeyDialog.getByRole('textbox', { name: 'API key' }).fill('bad-key');
  await savedKeyDialog.getByRole('button', { name: 'Test key' }).click();
  await expect(savedKeyDialog.getByRole('alert')).toContainText('API key not valid.');
});

test('course workspace stays within mobile, tablet, and desktop widths', async ({ page }) => {
  await seedCourse(page);
  await page.goto('/#/course/course-test');
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await waitForFonts(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 375) {
      const stickyWorkspace = page.locator('[data-testid="course-player"] .sticky').first();
      await expect(stickyWorkspace).toHaveCSS('position', 'sticky');
      await expect(stickyWorkspace).toHaveCSS('top', '0px');
      await page.getByTestId('player-scroll-area').evaluate(element => element.scrollTop = 250);
      await expect.poll(async () => (await stickyWorkspace.boundingBox())?.y ?? -1).toBe(56);
    }
  }
});

test('AI study guide renders highlights and interactive flashcards', async ({ page }) => {
  await seedCourse(page);
  const studyGuide = {
    oneSentenceSummary: 'A concise lesson summary.',
    keyTakeaways: ['State changes update the interface.'],
    detailedNotes: '# Lesson study notes\n\n## Core ideas\n\n- State is lesson data.',
    timestampedHighlights: [{ time: '00:12', seconds: 12, label: 'React state' }],
    quizQuestions: Array.from({ length: 10 }, (_, index) => ({ question: `Study question ${index + 1}`, options: ['Lesson data', 'A route', 'A stylesheet', 'An API key'], answerIndex: 0 }))
  };
  await page.addInitScript((guide) => {
    localStorage.setItem('courseify:gemini-api-key', 'test-key');
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
      if (url.includes('generativelanguage.googleapis.com')) {
        return Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(guide) }] } }], usageMetadata: { totalTokenCount: 75 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      return nativeFetch(input, init);
    };
  }, studyGuide);
  await page.goto('/#/course/course-test');
  await openWorkspaceTab(page, 'AI Notes');
  await page.getByRole('button', { name: 'Generate study guide' }).click();
  await expect(page.getByText(studyGuide.oneSentenceSummary)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Quiz (10)' })).toBeVisible();
  const aiWorkspace = page.getByRole('region', { name: 'AI session notes' });
  await aiWorkspace.getByRole('tab', { name: 'Notes' }).click();
  await expect(aiWorkspace.getByRole('heading', { name: 'Core ideas' })).toBeVisible();
  await expect(aiWorkspace.getByRole('listitem')).toContainText('State is lesson data.');
  await aiWorkspace.getByRole('tab', { name: 'Highlights' }).click();
  await expect(page.getByRole('button', { name: /React state/ })).toBeVisible();
  await openWorkspaceTab(page, 'Flashcards', 'AI study guide sections');
  await page.getByRole('button', { name: 'Question flashcard 1', exact: true }).click();
  await expect(page.getByText('Lesson data', { exact: true })).toBeVisible();
});

test('selecting a lesson initializes the YouTube player with its video id', async ({ page }) => {
  await seedCourse(page);
  await page.addInitScript(() => {
    const loadedIds: string[] = [];
    (window as any).__ytLoadedIds = loadedIds;
    (window as any).__ytSeekLog = [];
    (window as any).__ytPlayCalls = 0;
    (window as any).YT = {
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 },
      Player: class {
        constructor(container: HTMLElement, options: any) {
          loadedIds.push(options.videoId);
          const iframe = document.createElement('iframe');
          container.appendChild(iframe);
          setTimeout(() => options.events.onReady({ target: this }), 0);
        }
        getIframe() { return document.querySelector('iframe'); }
        getCurrentTime() { return 0; }
        getDuration() { return 60; }
        getVideoLoadedFraction() { return 0; }
        getAvailableQualityLevels() { return []; }
        getPlaybackQuality() { return 'auto'; }
        getVolume() { return 100; }
        isMuted() { return false; }
        playVideo() { (window as any).__ytPlayCalls += 1; }
        pauseVideo() {}
        seekTo(seconds: number) { (window as any).__ytSeekLog.push(seconds); }
        setPlaybackQuality() {}
        unloadModule() {}
        destroy() { document.querySelector('iframe')?.remove(); }
      }
    };
  });
  await page.goto('/#/course/course-test');
  await expect.poll(() => page.evaluate(() => (window as any).__ytLoadedIds)).toContain('abc12345678');
  await page.locator('[data-testid="lesson-item"]:visible').nth(1).click();
  await expect(page.getByTestId('current-lesson-title')).toHaveText('Second lesson');
  await expect.poll(() => page.evaluate(() => (window as any).__ytLoadedIds)).toContain('def12345678');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('courseify:seek-player', { detail: 42 })));
  await expect.poll(() => page.evaluate(() => (window as any).__ytSeekLog)).toContain(42);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('k');
  await expect.poll(() => page.evaluate(() => (window as any).__ytPlayCalls)).toBe(1);
  await openWorkspaceTab(page, 'Notes');
  await page.getByRole('button', { name: /click to add note/i }).click();
  await page.getByTestId('notes-editor').fill('Key detail: ');
  await page.getByTestId('notes-editor').press('k');
  await expect(page.evaluate(() => (window as any).__ytPlayCalls)).resolves.toBe(1);
  await page.getByRole('button', { name: /Insert 00:00/ }).click();
  await expect.poll(() => page.evaluate(() => {
    const notes = JSON.parse(localStorage.getItem('courseify:v1:course:course-test:notes') || '{}');
    return notes['def12345678']?.text || '';
  })).toContain('[00:00](#timestamp-0)');
});

test('Gemini quota errors remain visible in the AI workspace', async ({ page }) => {
  await seedCourse(page);
  await stubGemini(page, [{ status: 429, message: 'Daily quota exceeded.' }]);

  await page.goto('/#/course/course-test');
  await openWorkspaceTab(page, 'AI Notes');
  await page.getByRole('button', { name: 'Generate study guide' }).click();

  await expect(page.getByRole('alert')).toContainText('Daily quota exceeded.');
  // An exhausted quota cannot refill in seconds, so the message is surfaced at
  // once rather than held behind a backoff the user would just wait through.
  expect(await geminiCalls(page)).toBe(1);
});

/**
 * Stub the Gemini endpoint with a scripted sequence of responses, and count the
 * attempts so a test can assert how hard the client tried.
 *
 * @param statuses one entry per response the endpoint should return. The last
 *   entry repeats, so a test only has to describe the failures it cares about.
 */
function stubGemini(page: Page, statuses: Array<{ status: number; message?: string; body?: string }>) {
  return page.addInitScript(responses => {
    localStorage.setItem('courseify:gemini-api-key', 'test-key');
    const calls: number[] = [];
    (window as unknown as { __geminiCalls: number[] }).__geminiCalls = calls;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
      if (!url.includes('generativelanguage.googleapis.com')) return nativeFetch(input, init);

      calls.push(calls.length);
      const step = responses[Math.min(calls.length - 1, responses.length - 1)];
      if (step.body !== undefined) {
        return Promise.resolve(new Response(step.body, {
          status: step.status,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      return Promise.resolve(new Response(JSON.stringify({ error: { message: step.message || 'boom' } }), {
        status: step.status,
        headers: { 'Content-Type': 'application/json' }
      }));
    };
  }, statuses);
}

const geminiCalls = (page: Page) => page.evaluate(() => (window as unknown as { __geminiCalls: number[] }).__geminiCalls.length);

/**
 * A minimal but complete study guide, shaped the way the API returns one.
 * At least one well-formed quiz question is required, because the service
 * rejects a guide that has no usable questions.
 */
const recoveredGuide = JSON.stringify({
  candidates: [{
    content: {
      parts: [{
        text: JSON.stringify({
          oneSentenceSummary: 'A recovered study guide.',
          keyTakeaways: ['First point', 'Second point'],
          detailedNotes: '# Notes\n\nSome detail.',
          timestampedHighlights: [],
          quizQuestions: [{
            question: 'Which point came first?',
            options: ['First point', 'Second point', 'A third point', 'A fourth point'],
            answerIndex: 0
          }]
        })
      }]
    }
  }]
});

test('a transient Gemini capacity error is retried instead of shown as a failure', async ({ page }) => {
  await seedCourse(page);
  // The first attempt hits Google's "high demand" 503; the second succeeds.
  await stubGemini(page, [
    { status: 503, message: 'This model is currently experiencing high demand.' },
    { status: 200, body: recoveredGuide }
  ]);

  await page.goto('/#/course/course-test');
  await openWorkspaceTab(page, 'AI Notes');
  await page.getByRole('button', { name: 'Generate study guide' }).click();

  // The guide arrives, so the user never has to press Generate again.
  await expect(page.getByText('A recovered study guide.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await geminiCalls(page)).toBe(2);
});

test('a sustained Gemini capacity error explains whose side it is on', async ({ page }) => {
  await seedCourse(page);
  await stubGemini(page, [{ status: 503, message: 'This model is currently experiencing high demand.' }]);

  await page.goto('/#/course/course-test');
  await openWorkspaceTab(page, 'AI Notes');
  await page.getByRole('button', { name: 'Generate study guide' }).click();

  const alert = page.getByRole('alert');
  // The backoff is jittered, so four attempts can legitimately take up to ~7s
  // before the error is surfaced. The default 5s assertion wait is too tight.
  const wait = { timeout: 20_000 };
  await expect(alert).toContainText('Google', wait);
  // Google's raw capacity wording is replaced, not passed through.
  await expect(alert).not.toContainText('experiencing high demand', wait);
  // One initial attempt plus three retries, then it gives up and says so.
  expect(await geminiCalls(page)).toBe(4);
});

test('a Gemini request that cannot succeed is not retried', async ({ page }) => {
  await seedCourse(page);
  await stubGemini(page, [{ status: 400, message: 'Malformed request.' }]);

  await page.goto('/#/course/course-test');
  await openWorkspaceTab(page, 'AI Notes');
  await page.getByRole('button', { name: 'Generate study guide' }).click();

  await expect(page.getByRole('alert')).toContainText('Malformed request.');
  // Retrying a permanent failure would only burn the user's quota.
  expect(await geminiCalls(page)).toBe(1);
});