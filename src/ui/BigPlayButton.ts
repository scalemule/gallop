import { Icons } from './IconSet';
import { svgIcon } from '../utils/dom';

export type BigPlayButtonMode = 'play' | 'replay';

/**
 * Centered overlay button that triggers playback / replay.
 *
 * Two modes:
 *   - 'play' (default): play triangle, shown in idle / ready / paused
 *   - 'replay':         circular reload arrow, shown when the video has ended
 *
 * The icon swaps via a tiny re-render rather than two stacked SVGs so the
 * `data-mode` attribute is also available for CSS hooks (e.g., a slightly
 * different background tint for the replay state).
 */
export class BigPlayButton {
  readonly element: HTMLButtonElement;
  private mode: BigPlayButtonMode = 'play';

  constructor(onClick: () => void) {
    this.element = document.createElement('button');
    this.element.className = 'gallop-big-play';
    this.element.setAttribute('aria-label', 'Play');
    this.element.setAttribute('data-mode', 'play');
    this.element.appendChild(svgIcon(Icons.play));
    this.element.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  }

  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
  }

  setMode(next: BigPlayButtonMode): void {
    if (this.mode === next) return;
    this.mode = next;
    while (this.element.firstChild) this.element.removeChild(this.element.firstChild);
    this.element.appendChild(svgIcon(next === 'replay' ? Icons.replay : Icons.play));
    this.element.setAttribute('data-mode', next);
    this.element.setAttribute('aria-label', next === 'replay' ? 'Replay' : 'Play');
  }
}
