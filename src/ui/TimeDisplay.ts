import { formatTime } from '../utils/time';

export class TimeDisplay {
  readonly element: HTMLSpanElement;
  private currentTime = 0;
  private duration = 0;

  constructor() {
    this.element = document.createElement('span');
    this.element.className = 'gallop-time';
    this.render();
  }

  update(currentTime: number, duration: number): void {
    this.currentTime = currentTime;
    this.duration = duration;
    this.render();
  }

  private render(): void {
    this.element.textContent = `${formatTime(this.currentTime)} / ${formatTime(this.duration)}`;
  }
}
