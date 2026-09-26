import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

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

async function seedCourse(page: Page) {
  await page.addInitScript(({ courseData, videoData }) => {
    localStorage.setItem('courseify:v1:courses', JSON.stringify([courseData]));
    localStorage.setItem(`courseify:v1:course:${courseData.id}:videos`, JSON.stringify(videoData));
    localStorage.setItem(`courseify:v1:course:${courseData.id}:progress`, JSON.stringify({ lastVideoId: videoData[0].videoId, updatedAt: new Date().toISOString(), completedAt: null, videos: {} }));
  }, { courseData: course, videoData: videos });
}

test('add-course form exposes invalid URL state', async ({ page }) => {
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
  const notesTab = page.getByRole('tab', { name: 'Notes', exact: true });
  if (await notesTab.isVisible()) await notesTab.click();
  await page.getByRole('button', { name: /click to add note/i }).click();
  await expect(page.getByTestId('notes-editor')).toBeVisible();
});

test('dashboard exposes seeded course state on mobile', async ({ page }) => {
  await seedCourse(page);
  await page.goto('/#/dashboard');
  await expect(page.getByTestId('dashboard')).toBeVisible();
  await expect(page.getByTestId('course-card')).toContainText('Inspectable Course');
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
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
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 375) {
      await expect(page.locator('[data-testid="course-player"] .sticky').first()).toHaveCSS('position', 'sticky');
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
  const mobileAiTab = page.getByRole('tab', { name: 'AI Notes' });
  if (await mobileAiTab.isVisible()) await mobileAiTab.click();
  await page.getByRole('button', { name: 'Generate study guide' }).click();
  await expect(page.getByText(studyGuide.oneSentenceSummary)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Quiz (10)' })).toBeVisible();
  const aiWorkspace = page.getByRole('region', { name: 'AI session notes' });
  await aiWorkspace.getByRole('tab', { name: 'Notes' }).click();
  await expect(aiWorkspace.getByRole('heading', { name: 'Core ideas' })).toBeVisible();
  await expect(aiWorkspace.getByRole('listitem')).toContainText('State is lesson data.');
  await aiWorkspace.getByRole('tab', { name: 'Highlights' }).click();
  await expect(page.getByRole('button', { name: /React state/ })).toBeVisible();
  const workspaceTabs = page.getByRole('tablist', { name: 'Course workspace' });
  if (await workspaceTabs.isVisible()) await workspaceTabs.getByRole('tab', { name: 'Flashcards' }).click();
  else await page.getByRole('region', { name: 'AI session notes' }).getByRole('tab', { name: 'Flashcards' }).click();
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
  await page.keyboard.press('k');
  await expect.poll(() => page.evaluate(() => (window as any).__ytPlayCalls)).toBe(1);
  const workspaceNotesTab = page.getByRole('tablist', { name: 'Course workspace' }).getByRole('tab', { name: 'Notes', exact: true });
  if (await workspaceNotesTab.isVisible()) await workspaceNotesTab.click();
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
  await page.addInitScript(() => {
    localStorage.setItem('courseify:gemini-api-key', 'test-key');
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
      if (url.includes('generativelanguage.googleapis.com')) {
        return Promise.resolve(new Response(JSON.stringify({ error: { message: 'Daily quota exceeded.' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      return nativeFetch(input, init);
    };
  });
  await page.goto('/#/course/course-test');
  const mobileAiTab = page.getByRole('tab', { name: 'AI Notes' });
  if (await mobileAiTab.isVisible()) await mobileAiTab.click();
  await page.getByRole('button', { name: 'Generate study guide' }).click();
  await expect(page.getByRole('alert')).toContainText('Daily quota exceeded.');
});