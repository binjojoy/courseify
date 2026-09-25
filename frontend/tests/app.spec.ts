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
  const notesTab = page.getByRole('button', { name: 'Notes', exact: true });
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