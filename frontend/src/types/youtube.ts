/**
 * Minimal structural types for the YouTube IFrame Player API.
 *
 * The player is loaded by injecting a script tag and talking to
 * `window.YT.Player`, which ships no type declarations. Describing the surface
 * Courseify actually touches keeps the player component free of `any` and means
 * a YouTube API change shows up as a compile error rather than a runtime
 * `undefined is not a function` inside a timer callback.
 *
 * @see https://developers.google.com/youtube/iframe_api_reference
 */

export interface YTPlayerVars {
  autoplay?: 0 | 1;
  controls?: 0 | 1;
  disablekb?: 0 | 1;
  fs?: 0 | 1;
  iv_load_policy?: 1 | 3;
  modestbranding?: 0 | 1;
  origin?: string;
  playsinline?: 0 | 1;
  rel?: 0 | 1;
  start?: number;
  cc_lang_pref?: string;
  cc_load_policy?: 0 | 1;
  enablejsapi?: 0 | 1;
  widget_referrer?: string;
  hl?: string;
  list?: string;
  loop?: 0 | 1;
}

export type YTPlayerEventType = 'onReady' | 'onStateChange' | 'onError' | 'onPlaybackQualityChange';

export type YTPlayerConstructor = new (
  element: HTMLElement | string,
  options: YTPlayerVarsOptions
) => YTPlayer;

export interface YTPlayerVarsOptions {
  videoId: string;
  playerVars?: YTPlayerVars;
  events?: Partial<Record<YTPlayerEventType, (event: YTPlayerEvent) => void>>;
}

export interface YTPlayerEvent {
  target: YTPlayer;
  data?: unknown;
}

export interface YTPlayer {
  // --- Time and state ---
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): YTPlayerState;
  getVideoData(): { video_id: string; title: string; author: string };
  getIframe(): HTMLIFrameElement;
  getVideoUrl(): string;
  getVideoLoadedFraction(): number;

  // --- Transport ---
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  /** Positional signature: `loadVideoById(id, startSeconds)`. */
  loadVideoById(videoId: string, startSeconds?: number): void;
  stopVideo(): void;
  destroy(): void;

  // --- Audio ---
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;

  // --- Quality ---
  setPlaybackQuality(suggestedQuality: string): void;
  getPlaybackQuality(): string;
  getAvailableQualityLevels(): string[];

  // --- Optional modules. Not every embed exposes these, hence optional. ---
  loadModule?(module: string): void;
  unloadModule?(module: string): void;
  setOption?(module: string, option: string, value: unknown): void;
}

export enum YTPlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5
}

/**
 * YouTube player error codes. Only the ones Courseify can do something about
 * are named; anything else is surfaced to the user without a stored verdict.
 */
export const YTPlayerError = {
  INVALID_PARAMETER: 2,
  HTML5_ERROR: 5,
  NOT_FOUND: 100,
  NOT_EMBEDDABLE: 101,
  DECLINED_EMBED: 150
} as const;

/**
 * Codes that mean "this video can never play here", as opposed to a transient
 * network or DRM problem. Only these persist `unavailable` to storage.
 */
export const PERMANENT_PLAYBACK_ERRORS: readonly number[] = [
  YTPlayerError.NOT_FOUND,
  YTPlayerError.NOT_EMBEDDABLE,
  YTPlayerError.DECLINED_EMBED
];

export const isPermanentPlaybackError = (code: unknown): boolean =>
  typeof code === 'number' && PERMANENT_PLAYBACK_ERRORS.includes(code);

/** Callback surface installed on `window` by the IFrame API script. */
export interface YTNamespace {
  Player: YTPlayerConstructor;
  PlayerState: typeof YTPlayerState;
  setConfig?: (config: { playerVars?: YTPlayerVars }) => void;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * Resolves once the IFrame API script has parsed. The script is only ever
 * injected once per document; concurrent callers share the same promise.
 */
let apiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeIframeApi(timeoutMs = 10000): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube player requires a browser environment.'));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-courseify-yt-api]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.courseifyYtApi = 'true';
      document.head.appendChild(script);
    }

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };

    const timer = window.setTimeout(() => {
      finish(() => {
        apiPromise = null;
        reject(new Error('The YouTube player took too long to load. Check your connection and try again.'));
      });
    }, timeoutMs);

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      // Preserve any other consumer's hook rather than clobbering it.
      if (typeof previous === 'function') previous();
      if (!window.YT?.Player) {
        finish(() => {
          apiPromise = null;
          reject(new Error('The YouTube player could not be initialised.'));
        });
        return;
      }
      finish(() => resolve(window.YT as YTNamespace));
    };
  });

  return apiPromise;
}

/** Test seam: drops the memoised loader so a new document can load the API. */
export function resetYouTubeIframeApiForTests(): void {
  apiPromise = null;
}
