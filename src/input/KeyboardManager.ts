import type { GallopPlayerCore } from '../core/GallopPlayerCore';
import { SEEK_STEP, SEEK_STEP_LARGE, VOLUME_STEP } from '../constants';

export class KeyboardManager {
  private player: GallopPlayerCore;
  private handler: (e: KeyboardEvent) => void;

  constructor(player: GallopPlayerCore) {
    this.player = player;

    this.handler = (e: KeyboardEvent) => {
      const wrapper = player.getWrapperElement();
      if (!wrapper.contains(document.activeElement) && document.activeElement !== wrapper) {
        return;
      }

      // Don't capture if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          player.togglePlay();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          player.seekBackward(SEEK_STEP);
          break;

        case 'ArrowRight':
          e.preventDefault();
          player.seekForward(SEEK_STEP);
          break;

        case 'j':
          e.preventDefault();
          player.seekBackward(SEEK_STEP_LARGE);
          break;

        case 'l':
          e.preventDefault();
          player.seekForward(SEEK_STEP_LARGE);
          break;

        case 'ArrowUp':
          e.preventDefault();
          player.volume = Math.min(1, player.volume + VOLUME_STEP);
          break;

        case 'ArrowDown':
          e.preventDefault();
          player.volume = Math.max(0, player.volume - VOLUME_STEP);
          break;

        case 'm':
          e.preventDefault();
          player.toggleMute();
          break;

        case 'f':
          e.preventDefault();
          player.toggleFullscreen();
          break;

        case '0':
        case 'Home':
          e.preventDefault();
          player.seek(0);
          break;

        case 'End':
          e.preventDefault();
          player.seek(player.duration);
          break;

        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9': {
          e.preventDefault();
          const pct = parseInt(e.key) / 10;
          player.seek(player.duration * pct);
          break;
        }

        case '<':
          e.preventDefault();
          this.cycleSpeed(-1);
          break;

        case '>':
          e.preventDefault();
          this.cycleSpeed(1);
          break;
      }
    };

    document.addEventListener('keydown', this.handler);
  }

  private cycleSpeed(direction: number): void {
    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const current = this.player.playbackRate;
    const idx = speeds.indexOf(current);
    const next = idx + direction;
    if (next >= 0 && next < speeds.length) {
      this.player.playbackRate = speeds[next];
    }
  }

  destroy(): void {
    document.removeEventListener('keydown', this.handler);
  }
}
