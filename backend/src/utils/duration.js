/**
 * Parse ISO 8601 duration string (e.g. PT1H2M3S, PT14M32S, P1DT2H, etc.) to seconds.
 * @param {string} isoDuration 
 * @returns {number} duration in seconds
 */
export function parseISODuration(isoDuration) {
  if (!isoDuration || typeof isoDuration !== 'string') return 0;
  
  // Quick return for empty or 0 durations
  if (isoDuration === 'P0D' || isoDuration === 'PT0S') return 0;

  const regex = /P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/;
  const matches = isoDuration.match(regex);
  if (!matches) return 0;

  const days = parseInt(matches[1] || '0', 10);
  const hours = parseInt(matches[2] || '0', 10);
  const minutes = parseInt(matches[3] || '0', 10);
  const seconds = parseInt(matches[4] || '0', 10);

  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format seconds into MM:SS or H:MM:SS format
 * @param {number} totalSeconds 
 * @returns {string} e.g. "14:32" or "1:02:15"
 */
export function formatTime(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const sec = Math.floor(totalSeconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');

  if (h > 0) {
    return `${h}:${mm}:${ss}`;
  }
  return `${m}:${ss}`;
}

/**
 * Format total duration into human text like "5h 10m" or "45m"
 * @param {number} totalSeconds 
 * @returns {string} e.g. "5h 10m" or "45m"
 */
export function formatDurationHuman(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0m';
  const sec = Math.floor(totalSeconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);

  if (h > 0 && m > 0) {
    return `${h}h ${m}m`;
  }
  if (h > 0) {
    return `${h}h`;
  }
  return `${m}m`;
}
