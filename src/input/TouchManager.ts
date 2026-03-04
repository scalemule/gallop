import type { GallopPlayerCore } from '../core/GallopPlayerCore';
import { DOUBLE_TAP_DELAY, SEEK_STEP_LARGE } from '../constants';

export class TouchManager {
  private player: GallopPlayerCore;
  private wrapper: HTMLElement;
  private lastTapTime = 0;
  private lastTapX = 0;
  private tapTimeout: ReturnType<typeof setTimeout> | null = null;
  private handler: (e: TouchEvent) => void;

  constructor(player: GallopPlayerCore, wrapper: HTMLElement) {
    this.player = player;
    this.wrapper = wrapper;

    this.handler = (e: TouchEvent) => {
      // Ignore touches on control elements
      const target = e.target as HTMLElement;
      if (target.closest('.gallop-controls') || target.closest('.gallop-big-play')) {
        return;
      }

      const touch = e.changedTouches[0];
      const now = Date.now();
      const timeDiff = now - this.lastTapTime;

      if (timeDiff < DOUBLE_TAP_DELAY) {
        // Double tap
        if (this.tapTimeout) {
          clearTimeout(this.tapTimeout);
          this.tapTimeout = null;
        }

        const rect = wrapper.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const halfWidth = rect.width / 2;

        if (x < halfWidth) {
          player.seekBackward(SEEK_STEP_LARGE);
        } else {
          player.seekForward(SEEK_STEP_LARGE);
        }
      } else {
        // Single tap — toggle play after delay (to distinguish from double tap)
        this.tapTimeout = setTimeout(() => {
          player.togglePlay();
          this.tapTimeout = null;
        }, DOUBLE_TAP_DELAY);
      }

      this.lastTapTime = now;
      this.lastTapX = touch.clientX;
    };

    wrapper.addEventListener('touchend', this.handler);
  }

  destroy(): void {
    this.wrapper.removeEventListener('touchend', this.handler);
    if (this.tapTimeout) clearTimeout(this.tapTimeout);
  }
}
