import type { Page } from '@playwright/test';

/**
 * Test doubles for the YouTube IFrame API.
 *
 * Shared because more than one spec needs a player that never surprises them.
 * The real embed plays, ends, and advances the lesson on its own, so any test
 * that asserts on surrounding UI can have that UI torn out from under it: an
 * AI study guide test lost its selected tab because the video ended, autoplay
 * moved to the next lesson, and the panel reset itself. Stubbing the player is
 * the only way to keep such a test deterministic.
 */

export interface ControllablePlayerLog {
  constructed: number;
  destroyed: number;
  playCalls: number;
  pauseCalls: number;
  mediaTime: number;
  state: number;
}

/**
 * A controllable stand-in for the IFrame API.
 *
 * Records how many times an embed is constructed or destroyed, lets the test
 * drive the playback clock, and can emit the state changes YouTube would emit
 * on its own. That is what makes it possible to assert the two symptoms a user
 * actually reported: a video that reloads every few seconds, and a pause that
 * does not stick.
 *
 * It reports PLAYING once and never reaches ENDED, so it will not trip
 * autoplay-next.
 */
export function stubControllablePlayer(page: Page) {
  return page.addInitScript(() => {
    const log = {
      constructed: 0,
      destroyed: 0,
      playCalls: 0,
      pauseCalls: 0,
      mediaTime: 0,
      state: 1
    };
    (window as unknown as { __yt: typeof log }).__yt = log;

    const live = new Set<{ fire: (state: number) => void }>();

    (window as unknown as { YT: unknown }).YT = {
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
      Player: class {
        private onStateChange: (e: { target: unknown; data: number }) => void;

        constructor(container: HTMLElement, options: { videoId: string; events: Record<string, (e: never) => void> }) {
          log.constructed += 1;
          const iframe = document.createElement('iframe');
          iframe.title = 'Course lesson video';
          container.appendChild(iframe);
          this.onStateChange = options.events.onStateChange as unknown as (e: { target: unknown; data: number }) => void;
          const entry = { fire: (state: number) => this.onStateChange({ target: this, data: state }) };
          live.add(entry);
          setTimeout(() => {
            (options.events.onReady as unknown as (e: { target: unknown }) => void)({ target: this });
            entry.fire(1);
          }, 0);
        }
        getIframe() { return document.querySelector('iframe'); }
        getCurrentTime() { return log.mediaTime; }
        getDuration() { return 600; }
        getPlayerState() { return log.state; }
        getVideoLoadedFraction() { return 1; }
        getAvailableQualityLevels() { return []; }
        getPlaybackQuality() { return 'auto'; }
        getVolume() { return 100; }
        getPlaybackRate() { return 1; }
        isMuted() { return false; }
        playVideo() { log.playCalls += 1; log.state = 1; }
        pauseVideo() { log.pauseCalls += 1; log.state = 2; }
        seekTo(seconds: number) { log.mediaTime = seconds; }
        setPlaybackQuality() {}
        setPlaybackRate() {}
        setVolume() {}
        mute() {}
        unMute() {}
        stopVideo() {}
        unloadModule() {}
        destroy() { log.destroyed += 1; document.querySelector('iframe')?.remove(); }
      }
    };

    (window as unknown as { __ytSeek: unknown }).__ytSeek = (seconds: number) => {
      log.mediaTime = seconds;
    };
    (window as unknown as { __ytPause: unknown }).__ytPause = () => {
      log.state = 2;
      live.forEach(entry => entry.fire(2));
    };
  });
}

export const ytLog = (page: Page) =>
  page.evaluate(() => (window as unknown as { __yt: ControllablePlayerLog }).__yt);
