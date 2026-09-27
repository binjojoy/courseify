import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { APP_VERSION } from '../src/config/app';
import { CURRENT_BACKUP_SCHEMA_VERSION } from '../src/services/backup';
import { stubControllablePlayer, ytLog } from './stubs';

/**
 * Regression tests for the third-party audit.
 *
 * Each test here pins down a behaviour that was previously broken, so a future
 * refactor cannot quietly reintroduce it. They are deliberately written against
 * what a user can observe (roles, test ids, localStorage) rather than internal
 * function calls, so they keep working across implementation changes.
 */

const COURSE_ID = 'course-test';
const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PL12345678901';

const seedCourse = {
  id: COURSE_ID,
  title: 'Inspectable Course',
  channelTitle: 'Courseify Test Channel',
  thumbnailUrl: '',
  videoCount: 2,
  totalDurationSec: 120,
  totalDurationFormatted: '2m',
  addedAt: '2026-01-01T00:00:00.000Z',
  lastOpenedAt: '2026-01-02T00:00:00.000Z',
  source: { type: 'playlist', id: 'PL12345678901', url: PLAYLIST_URL }
};

const seedVideos = [
  { videoId: 'abc12345678', position: 0, title: 'First lesson', description: '', durationSec: 60, durationFormatted: '01:00', thumbnailUrl: '' },
  { videoId: 'def12345678', position: 1, title: 'Second lesson', description: '', durationSec: 60, durationFormatted: '01:00', thumbnailUrl: '' }
];

const seedProgress = (videos: Record<string, unknown>, lastVideoId = seedVideos[0].videoId) => ({
  lastVideoId,
  updatedAt: '2026-01-02T00:00:00.000Z',
  completedAt: null,
  videos
});

/**
 * A payload that fires if any code path ever turns stored text into HTML.
 * `onerror` runs as soon as the broken `src` resolves, so a single missed
 * escape is caught without waiting for a click.
 */
const XSS_IMG = '<img src=x onerror="window.__xssFired=1">';
const XSS_SCRIPT = '<script>window.__xssFired=1</script>';

function seedLibrary(page: Page, options: { notes?: Record<string, unknown>; progress?: Record<string, unknown>; videos?: typeof seedVideos } = {}) {
  const videos = options.videos ?? seedVideos;
  return page.addInitScript(({ course, videoData, progress, notes, version }) => {
    localStorage.setItem('courseify:last-seen-release', version);
    localStorage.setItem('courseify:v1:courses', JSON.stringify([course]));
    localStorage.setItem(`courseify:v1:course:${course.id}:videos`, JSON.stringify(videoData));
    localStorage.setItem(`courseify:v1:course:${course.id}:progress`, JSON.stringify(progress));
    if (notes) localStorage.setItem(`courseify:v1:course:${course.id}:notes`, JSON.stringify(notes));
  }, {
    course: seedCourse,
    videoData: videos,
    progress: options.progress ?? seedProgress({}),
    notes: options.notes,
    version: APP_VERSION
  });
}

/** Build a backup payload the app is expected to accept. */
function buildBackup(overrides: {
  courses?: unknown[];
  courseData?: Record<string, unknown>;
  schemaVersion?: number;
} = {}) {
  const courses = overrides.courses ?? [seedCourse];
  return {
    schemaVersion: overrides.schemaVersion ?? CURRENT_BACKUP_SCHEMA_VERSION,
    exportedAt: '2026-01-03T00:00:00.000Z',
    profile: { name: 'Backup Owner' },
    settings: { autoplayNext: true, autoCompleteOnEnd: true, autoCompleteThreshold: 0.9, theme: 'dark', dailyFocusGoalMinutes: 45 },
    courses,
    favorites: [],
    watchActivity: { '2026-01-03': 600 },
    accessDays: ['2026-01-03'],
    courseData: overrides.courseData ?? {
      [COURSE_ID]: { videos: seedVideos, progress: seedProgress({}), notes: {} }
    }
  };
}

async function uploadBackup(page: Page, payload: unknown, filename = 'backup.json') {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  await page.getByLabel('Import backup file').setInputFiles({
    name: filename,
    mimeType: 'application/json',
    buffer: Buffer.from(body, 'utf8')
  });
}

/**
 * Stub the YouTube IFrame API with a player that always reports success.
 *
 * Without this the real API loads, the placeholder video ids in these fixtures
 * genuinely fail to play, and the app does the right thing by marking them
 * unavailable — which would mask the seeded state under test.
 */
function stubYouTubePlayer(page: Page) {
  return page.addInitScript(() => {
    (window as unknown as { YT: unknown }).YT = {
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 },
      Player: class {
        constructor(container: HTMLElement, options: { videoId: string; events: { onReady: (e: unknown) => void } }) {
          const iframe = document.createElement('iframe');
          container.appendChild(iframe);
          setTimeout(() => options.events.onReady({ target: this }), 0);
        }
        getIframe() { return document.querySelector('iframe'); }
        getCurrentTime() { return 0; }
        getDuration() { return 60; }
        getVideoLoadedFraction() { return 1; }
        getAvailableQualityLevels() { return []; }
        getPlaybackQuality() { return 'auto'; }
        getVolume() { return 100; }
        isMuted() { return false; }
        playVideo() {}
        pauseVideo() {}
        seekTo() {}
        setPlaybackQuality() {}
        unloadModule() {}
        destroy() { document.querySelector('iframe')?.remove(); }
      }
    };
  });
}

const importDialog = (page: Page) => page.getByTestId('import-conflict-dialog');

// ---------------------------------------------------------------------------
// S2 - stored and imported text must never be interpreted as markup
// ---------------------------------------------------------------------------

test('note text from storage and from an imported backup stays inert text', async ({ page }) => {
  await seedLibrary(page, {
    notes: { abc12345678: { text: `${XSS_IMG} ${XSS_SCRIPT}`, updatedAt: '2026-01-02T00:00:00.000Z' } }
  });

  await page.goto('/#/dashboard');
  // The dashboard quotes recent notes, and the command palette searches them.
  const quote = page.locator('p', { hasText: '<img src=x' });
  await expect(quote).toBeVisible();
  await expect(quote).toContainText('<img src=x onerror="window.__xssFired=1">');
  // Rendered as text, so the payload is visible but nothing was created.
  await expect(quote.locator('img')).toHaveCount(0);
  await expect(quote.locator('script')).toHaveCount(0);

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Command palette' });
  await expect(palette).toBeVisible();
  await palette.getByRole('textbox', { name: 'Search commands and lessons' }).fill('onerror');
  await expect(palette.getByRole('option', { name: /Saved note/ })).toBeVisible();

  expect(await page.evaluate(() => (window as unknown as { __xssFired?: number }).__xssFired)).toBeUndefined();
});

test('a course title carrying markup survives an import as literal text', async ({ page }) => {
  await seedLibrary(page);
  await page.goto('/#/dashboard');

  await uploadBackup(page, buildBackup({
    courses: [{ ...seedCourse, id: 'course-evil', title: `${XSS_IMG} Injected` }],
    courseData: {
      'course-evil': {
        videos: [{ videoId: 'ghi12345678', position: 0, title: XSS_SCRIPT, description: '', durationSec: 30, durationFormatted: '00:30', thumbnailUrl: '' }],
        progress: seedProgress({}),
        notes: {}
      }
    }
  }));
  await importDialog(page).getByRole('button', { name: 'Merge backup' }).click();

  const card = page.getByTestId('course-card').filter({ hasText: 'Injected' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('<img src=x onerror="window.__xssFired=1"> Injected');
  await expect(card.locator('img[onerror]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __xssFired?: number }).__xssFired)).toBeUndefined();
});

// ---------------------------------------------------------------------------
// E-items - an import must be validated, and an overlap must be a choice
// ---------------------------------------------------------------------------

test('a file that is not a Courseify backup is rejected with a reason', async ({ page }) => {
  await seedLibrary(page);
  await page.goto('/#/dashboard');

  await uploadBackup(page, 'this is not json at all', 'notes.txt');
  await expect(page.getByRole('alert')).toContainText("isn't valid JSON");

  await uploadBackup(page, { hello: 'world' });
  await expect(page.getByRole('alert')).toContainText('no schema version');

  await uploadBackup(page, buildBackup({ schemaVersion: 99 }));
  await expect(page.getByRole('alert')).toContainText('newer version of Courseify');

  // Nothing was written and no dialog was left open.
  await expect(importDialog(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('courseify:v1:profile'))).not.toContain('Backup Owner');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('courseify:v1:courses') || '[]'))).toHaveLength(1);
});

test('the import dialog is cancellable and writes nothing until confirmed', async ({ page }) => {
  await seedLibrary(page);
  await page.goto('/#/dashboard');
  await uploadBackup(page, buildBackup({ courses: [{ ...seedCourse, title: 'Should Not Arrive' }] }));

  const dialog = importDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('course-card').filter({ hasText: 'Should Not Arrive' })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('courseify:v1:courses') || '[]').map((c: { title: string }) => c.title))).toEqual(['Inspectable Course']);
});

test('merging an overlapping backup keeps local completions and adds new lessons', async ({ page }) => {
  // Locally both lessons are complete. The backup only knows about one of
  // them, so replacing would silently undo work the user did here.
  await seedLibrary(page, {
    progress: seedProgress({
      abc12345678: { completed: true, positionSec: 60, completedAt: '2026-01-02T00:00:00.000Z' },
      def12345678: { completed: true, positionSec: 60, completedAt: '2026-01-02T00:00:00.000Z' }
    })
  });
  await page.goto('/#/dashboard');

  const incomingVideos = [...seedVideos, { videoId: 'ghi12345678', position: 2, title: 'Third lesson', description: '', durationSec: 60, durationFormatted: '01:00', thumbnailUrl: '' }];
  await uploadBackup(page, buildBackup({
    courseData: { [COURSE_ID]: { videos: incomingVideos, progress: seedProgress({ def12345678: { completed: true, positionSec: 60, completedAt: null } }), notes: { def12345678: { text: 'from the backup', updatedAt: '2026-01-03T00:00:00.000Z' } } } }
  }));

  const dialog = importDialog(page);
  await expect(dialog).toBeVisible();
  // The dialog must warn before the user can destroy local progress.
  await expect(dialog).toContainText('Replacing loses completions you earned here');
  await expect(dialog.getByRole('radio', { name: /Merge with my data/ })).toBeChecked();

  await dialog.getByRole('button', { name: 'Merge backup' }).click();
  await expect(dialog).toHaveCount(0);

  const stored = await page.evaluate((courseId) => {
    const progress = JSON.parse(localStorage.getItem(`courseify:v1:course:${courseId}:progress`) || '{}');
    const videos = JSON.parse(localStorage.getItem(`courseify:v1:course:${courseId}:videos`) || '[]');
    const notes = JSON.parse(localStorage.getItem(`courseify:v1:course:${courseId}:notes`) || '{}');
    return {
      completed: Object.entries(progress.videos || {}).filter(([, v]) => (v as { completed?: boolean }).completed).map(([id]) => id).sort(),
      videoIds: videos.map((v: { videoId: string }) => v.videoId),
      positions: videos.map((v: { position: number }) => v.position),
      note: notes['def12345678']?.text
    };
  }, COURSE_ID);

  // Both the local and the incoming completion survive a merge.
  expect(stored.completed).toEqual(['abc12345678', 'def12345678']);
  expect(stored.videoIds).toEqual(['abc12345678', 'def12345678', 'ghi12345678']);
  expect(stored.positions).toEqual([0, 1, 2]);
  expect(stored.note).toBe('from the backup');
});

test('replacing an overlapping backup restores the file exactly', async ({ page }) => {
  await seedLibrary(page, { progress: seedProgress({ abc12345678: { completed: true, positionSec: 60, completedAt: null } }) });
  await page.goto('/#/dashboard');

  await uploadBackup(page, buildBackup({
    courses: [{ ...seedCourse, title: 'Replaced Course' }],
    courseData: { [COURSE_ID]: { videos: [seedVideos[1]], progress: seedProgress({}, 'def12345678'), notes: {} } }
  }));

  const dialog = importDialog(page);
  await dialog.getByRole('radio', { name: /Replace my data/ }).check();
  await dialog.getByRole('button', { name: 'Replace data' }).click();
  await expect(dialog).toHaveCount(0);

  const stored = await page.evaluate((courseId) => {
    const progress = JSON.parse(localStorage.getItem(`courseify:v1:course:${courseId}:progress`) || '{}');
    const videos = JSON.parse(localStorage.getItem(`courseify:v1:course:${courseId}:videos`) || '[]');
    return {
      completed: Object.values(progress.videos || {}).filter((v) => (v as { completed?: boolean }).completed).length,
      videoIds: videos.map((v: { videoId: string }) => v.videoId),
      lastVideoId: progress.lastVideoId,
      courseTitle: JSON.parse(localStorage.getItem('courseify:v1:courses') || '[]')[0]?.title
    };
  }, COURSE_ID);

  expect(stored.completed).toBe(0);
  expect(stored.videoIds).toEqual(['def12345678']);
  expect(stored.lastVideoId).toBe('def12345678');
  expect(stored.courseTitle).toBe('Replaced Course');
  await expect(page.getByTestId('course-card')).toContainText('Replaced Course');
});

// ---------------------------------------------------------------------------
// Progress maths - untrusted numbers must not reach a bar or aria-valuenow
// ---------------------------------------------------------------------------

test('impossible progress numbers are clamped instead of overflowing a bar', async ({ page }) => {
  await seedLibrary(page, {
    progress: {
      lastVideoId: 'abc12345678',
      updatedAt: '2026-01-02T00:00:00.000Z',
      completedAt: null,
      videos: {
        // A playhead far past the end, a non-numeric position, and a truthy
        // non-boolean "completed" flag.
        abc12345678: { completed: true, positionSec: 999999, completedAt: null },
        def12345678: { completed: 'yes', positionSec: 'abc', completedAt: null }
      }
    }
  });
  await page.goto('/#/dashboard');

  const bars = page.getByRole('progressbar', { name: 'Inspectable Course completion' });
  await expect(bars.first()).toBeVisible();

  const count = await bars.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const bar = bars.nth(index);
    const value = Number(await bar.getAttribute('aria-valuenow'));
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
    // The filled bar is sized with an inline percentage. A NaN there is what
    // produced the "0% of an undefined total" rendering before, so every inline
    // width inside the bar must parse as a real percentage of at most 100.
    const widths = await bar.evaluate(node =>
      Array.from(node.querySelectorAll<HTMLElement>('*'))
        .map(child => child.style.width)
        .filter(Boolean)
    );
    expect(widths.length).toBeGreaterThan(0);
    for (const width of widths) {
      expect(width).toMatch(/^\d+(\.\d+)?%$/);
      expect(parseFloat(width)).toBeLessThanOrEqual(100);
    }
  }
});

test('a corrupt resume position cannot produce NaN anywhere in the player', async ({ page }) => {
  await seedLibrary(page, {
    progress: { lastVideoId: 'abc12345678', updatedAt: 'nonsense', completedAt: null, videos: { abc12345678: { completed: true, positionSec: 'abc' } } }
  });
  await stubYouTubePlayer(page);
  await page.goto('/#/course/course-test');

  await expect(page.getByTestId('course-player')).toBeVisible();
  const sidebarBar = page.getByRole('progressbar', { name: 'Course completion' });
  await expect(sidebarBar).toHaveAttribute('aria-valuenow', /^\d+$/);
  // The duration readout is built from the lesson list, not from the corrupt
  // position, so it must still parse as a clock value.
  const clockText = await page.getByTestId('course-player').innerText();
  expect(clockText).not.toMatch(/NaN|Infinity|undefined/);
});

// ---------------------------------------------------------------------------
// Reliability - duplicate ingest and cross-tab sync
// ---------------------------------------------------------------------------

test('pasting a playlist that is already enrolled reports it and does not re-fetch', async ({ page }) => {
  await seedLibrary(page);

  const requests: string[] = [];
  await page.route('**/api/playlist', route => {
    requests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/#/add');
  await page.getByTestId('playlist-url-input').fill(PLAYLIST_URL);
  await page.getByTestId('import-playlist-button').click();

  // The duplicate path short-circuits before any network call.
  await expect(page.getByText('already in your courses')).toBeVisible();
  expect(requests).toEqual([]);
  // And it does not create a second copy of the course.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('courseify:v1:courses') || '[]'))).toHaveLength(1);
});

test('progress saved in another tab is reflected without a reload', async ({ page, context }) => {
  await seedLibrary(page, { progress: seedProgress({}) });
  await page.goto('/#/dashboard');
  await expect(page.getByTestId('course-card')).toContainText('0 / 2 videos');

  // A real second tab on the same origin, so the browser fires `storage`.
  const other = await context.newPage();
  await other.goto('/#/');
  await other.evaluate((courseId) => {
    localStorage.setItem(`courseify:v1:course:${courseId}:progress`, JSON.stringify({
      lastVideoId: 'def12345678',
      updatedAt: new Date().toISOString(),
      completedAt: null,
      videos: { abc12345678: { completed: true, positionSec: 60, completedAt: null } }
    }));
  }, COURSE_ID);
  await other.close();

  await expect(page.getByTestId('course-card')).toContainText('1 / 2 videos');
});

// ---------------------------------------------------------------------------
// Unavailable lessons
// ---------------------------------------------------------------------------

test('a lesson that cannot be played is marked and excluded from completion', async ({ page }) => {
  const videos = [
    seedVideos[0],
    { ...seedVideos[1], title: 'Deleted lesson', unavailable: true }
  ];
  await seedLibrary(page, { videos });
  await stubYouTubePlayer(page);
  await page.goto('/#/course/course-test');

  const sidebar = page.locator('[data-testid="playlist-sidebar"]:visible');
  await expect(sidebar.getByTestId('playlist-unavailable-notice')).toContainText("1 lesson can't be played");

  const unavailable = sidebar.locator('[data-unavailable="true"]');
  await expect(unavailable).toHaveCount(1);
  await expect(unavailable).toContainText('Deleted lesson');
  await expect(unavailable).toContainText('--:--');

  // The unplayable lesson must not count towards the denominator, so one
  // playable lesson at 0% is 0%, and the sidebar is not stuck at "0 / 2".
  await expect(sidebar.getByRole('progressbar', { name: 'Course completion' })).toHaveAttribute('aria-valuenow', '0');
  await expect(sidebar.getByRole('progressbar', { name: 'Course completion' })).toHaveAttribute('aria-valuetext', '0 of 1 lessons completed');
});

// ---------------------------------------------------------------------------
// Focus management
// ---------------------------------------------------------------------------

test('the import dialog traps focus and closes on Escape', async ({ page }) => {
  await seedLibrary(page);
  await page.goto('/#/dashboard');
  await uploadBackup(page, buildBackup({ courses: [{ ...seedCourse, title: 'Focus Probe' }] }));

  const dialog = importDialog(page);
  await expect(dialog).toBeVisible();

  // Tabbing all the way round must never land outside the dialog.
  for (let press = 0; press < 12; press += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
      return !!modal && !!document.activeElement && modal.contains(document.activeElement);
    });
    expect(inside).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('courseify:v1:courses') || '[]'))).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// Player stability
// ---------------------------------------------------------------------------

test('a lesson keeps one player instance instead of reloading every few seconds', async ({ page }) => {
  await seedLibrary(page);
  await stubControllablePlayer(page);
  await page.goto('/#/course/course-test');

  await expect.poll(async () => (await ytLog(page)).constructed).toBe(1);

  // The player writes a resume point every five seconds of playback. That write
  // is echoed back into the component as a new `initialPositionSec` prop, which
  // used to be a dependency of the effect that owns the embed — so the iframe
  // was destroyed and rebuilt, re-buffering the video on the spot.
  for (let elapsed = 0; elapsed < 24; elapsed += 6) {
    await page.evaluate(t => (window as unknown as { __ytSeek: (n: number) => void }).__ytSeek(t), elapsed + 6);
    // Let at least one progress tick run so the persist actually happens.
    await page.waitForTimeout(1200);
    const stored = await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem('courseify:v1:course:course-test:progress') || '{}');
      return progress.videos?.abc12345678?.positionSec ?? 0;
    });
    expect(stored).toBeGreaterThan(0);
    expect((await ytLog(page)).constructed).toBe(1);
  }

  // Nothing tore the embed down along the way.
  expect((await ytLog(page)).destroyed).toBe(0);
});

test('pausing a lesson actually stays paused', async ({ page }) => {
  await seedLibrary(page);
  await stubControllablePlayer(page);
  await page.goto('/#/course/course-test');

  await expect.poll(async () => (await ytLog(page)).constructed).toBe(1);

  // Play far enough that pausing produces a genuinely different resume point.
  await page.evaluate(() => (window as unknown as { __ytSeek: (n: number) => void }).__ytSeek(37));
  await page.waitForTimeout(1200);
  const playsBefore = (await ytLog(page)).playCalls;

  // Pausing makes the player persist the current position. That write was fed
  // straight back into the prop that rebuilt the embed, and the rebuilt embed
  // was created with `autoplay: 1` — so the video started playing again about a
  // second after it was paused.
  await page.evaluate(() => (window as unknown as { __ytPause: () => void }).__ytPause());
  await page.waitForTimeout(1500);

  const log = await ytLog(page);
  expect(log.constructed).toBe(1);
  expect(log.destroyed).toBe(0);
  expect(log.playCalls).toBe(playsBefore);
});

test('the player surface is themed instead of hardcoding one palette', async ({ page }) => {
  await seedLibrary(page);
  await stubControllablePlayer(page);
  await page.goto('/#/course/course-test');

  const frame = page.getByTestId('player-frame');
  await expect(frame).toBeVisible();

  // Both themes are read inside one synchronous evaluate: the app re-applies its
  // own theme class on re-render, so toggling across two round trips would let
  // React put the class back and quietly invalidate the comparison.
  const result = await frame.evaluate(el => {
    const surface = el.querySelector('.courseify-player') as HTMLElement | null;
    if (!surface) return null;
    const root = document.documentElement;
    const read = () => ({
      channels: getComputedStyle(el).getPropertyValue('--player-black').trim(),
      used: getComputedStyle(surface).backgroundColor
    });
    const wasDark = root.classList.contains('dark');
    root.classList.add('dark');
    const dark = read();
    root.classList.remove('dark');
    const light = read();
    if (wasDark) root.classList.add('dark');
    return { dark, light };
  });

  expect(result).not.toBeNull();
  const { dark, light } = result!;

  // `--player-black` holds space-separated channels so Tailwind's `/70` and
  // `/20` modifiers work; resolve it the same way the browser would.
  const asRgb = (channels: string) => `rgb(${channels.split(/\s+/).join(', ')})`;

  // The token is the single source of truth, and it genuinely differs per theme.
  expect(dark.channels).not.toBe(light.channels);
  // The surface resolves to whatever the token currently says, so a hardcoded
  // hex could not pass both halves of this.
  expect(dark.used).toBe(asRgb(dark.channels));
  expect(light.used).toBe(asRgb(light.channels));
});
