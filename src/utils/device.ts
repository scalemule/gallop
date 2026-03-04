export function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 0 && /Macintosh/.test(navigator.userAgent));
}

export function supportsNativeHLS(): boolean {
  if (typeof document === 'undefined') return false;
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

export function supportsFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => void;
  };
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}
