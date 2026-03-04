import type { GallopPlayerCore } from '../core/GallopPlayerCore';

export class ProgressBar {
  readonly element: HTMLDivElement;
  private bar: HTMLDivElement;
  private buffered: HTMLDivElement;
  private played: HTMLDivElement;
  private thumb: HTMLDivElement;
  private player: GallopPlayerCore;
  private dragging = false;

  constructor(player: GallopPlayerCore) {
    this.player = player;

    this.element = document.createElement('div');
    this.element.className = 'gallop-progress-container';

    this.bar = document.createElement('div');
    this.bar.className = 'gallop-progress-bar';

    this.buffered = document.createElement('div');
    this.buffered.className = 'gallop-progress-buffered';

    this.played = document.createElement('div');
    this.played.className = 'gallop-progress-played';

    this.thumb = document.createElement('div');
    this.thumb.className = 'gallop-progress-thumb';

    this.bar.appendChild(this.buffered);
    this.bar.appendChild(this.played);
    this.bar.appendChild(this.thumb);
    this.element.appendChild(this.bar);

    this.element.addEventListener('mousedown', this.onMouseDown);
    this.element.addEventListener('touchstart', this.onTouchStart, { passive: false });
  }

  update(currentTime: number, duration: number, bufferedRanges: TimeRanges): void {
    if (this.dragging || !duration) return;

    const pct = (currentTime / duration) * 100;
    this.played.style.width = `${pct}%`;
    this.thumb.style.left = `${pct}%`;

    if (bufferedRanges.length > 0) {
      const bufferedEnd = bufferedRanges.end(bufferedRanges.length - 1);
      this.buffered.style.width = `${(bufferedEnd / duration) * 100}%`;
    }
  }

  private seekToPosition(clientX: number): void {
    const rect = this.bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = pct * this.player.duration;
    this.player.seek(time);

    this.played.style.width = `${pct * 100}%`;
    this.thumb.style.left = `${pct * 100}%`;
  }

  private onMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    this.dragging = true;
    this.seekToPosition(e.clientX);

    const onMove = (ev: MouseEvent) => this.seekToPosition(ev.clientX);
    const onUp = () => {
      this.dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.dragging = true;
    const touch = e.touches[0];
    this.seekToPosition(touch.clientX);

    const onMove = (ev: TouchEvent) => this.seekToPosition(ev.touches[0].clientX);
    const onEnd = () => {
      this.dragging = false;
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  };

  destroy(): void {
    this.element.removeEventListener('mousedown', this.onMouseDown);
    this.element.removeEventListener('touchstart', this.onTouchStart);
  }
}
