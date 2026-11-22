// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FullscreenButton } from '../../src/ui/components/common';

const doc = document as Document & { fullscreenEnabled: boolean; fullscreenElement: Element | null };
const setUA = (ua: string) => Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });

afterEach(() => {
  cleanup();
  Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true });
  Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true, writable: true });
  setUA('Mozilla/5.0 (X11; Linux x86_64)');
});

describe('full screen button', () => {
  it('uses the Fullscreen API where available (Android Chrome, desktop) and toggles', async () => {
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true, writable: true });
    const request = vi.fn(async () => {
      doc.fullscreenElement = document.documentElement;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    const exit = vi.fn(async () => {
      doc.fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    document.documentElement.requestFullscreen = request as never;
    document.exitFullscreen = exit as never;
    render(<FullscreenButton />);
    await act(async () => fireEvent.click(screen.getByText(/Full screen/)));
    expect(request).toHaveBeenCalledWith({ navigationUI: 'hide' });
    await waitFor(() => screen.getByText(/Exit full screen/));
    await act(async () => fireEvent.click(screen.getByText(/Exit full screen/)));
    expect(exit).toHaveBeenCalled();
    await waitFor(() => screen.getByText('⤢ Full screen'));
  });

  it('on iPhone, explains Add to Home Screen instead', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    render(<FullscreenButton />);
    fireEvent.click(screen.getByText(/Full screen/));
    expect(screen.getByText(/Add to Home Screen/)).toBeTruthy();
  });

  it('is hidden when already running from the home screen', () => {
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    render(<FullscreenButton />);
    expect(screen.queryByText(/Full screen/)).toBeNull();
    Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true });
  });
});
