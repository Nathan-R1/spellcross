// Fullscreen support (doc 03 § Orientation). Android Chrome and desktop browsers can hide the browser UI
// with the Fullscreen API; iPhone Safari can't (Apple allows it for video only), so there the answer is
// "Add to Home Screen", which launches the PWA without Safari's bars.

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

export type FullscreenSupport = 'api' | 'ios-home-screen' | 'installed' | 'none';

export function fullscreenSupport(): FullscreenSupport {
  if (typeof document === 'undefined') return 'none';
  const nav = navigator as Navigator & { standalone?: boolean };
  // Already running from the home screen (or as an installed app): there is no browser bar to hide.
  if (nav.standalone || window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches) return 'installed';
  const doc = document as FsDoc;
  if (doc.fullscreenEnabled || doc.webkitFullscreenEnabled) return 'api';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios ? 'ios-home-screen' : 'none';
}

export function isFullscreen(): boolean {
  const doc = document as FsDoc;
  return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export async function enterFullscreen(): Promise<void> {
  const el = document.documentElement as FsEl;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else await el.webkitRequestFullscreen?.();
  } catch {
    return; // The browser refused (e.g. not triggered by a tap): stay as we are.
  }
  // Best effort: Android Chrome allows locking orientation while fullscreen.
  try {
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape');
  } catch {
    /* unsupported: the rotate overlay covers portrait */
  }
}

export async function exitFullscreen(): Promise<void> {
  const doc = document as FsDoc;
  try {
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
  } catch {
    /* already out */
  }
}

export function onFullscreenChange(fn: () => void): () => void {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
  return () => {
    document.removeEventListener('fullscreenchange', fn);
    document.removeEventListener('webkitfullscreenchange', fn);
  };
}
