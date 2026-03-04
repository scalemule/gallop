import { Icons } from './IconSet';
import { svgIcon } from '../utils/dom';

export class BigPlayButton {
  readonly element: HTMLButtonElement;

  constructor(onClick: () => void) {
    this.element = document.createElement('button');
    this.element.className = 'gallop-big-play';
    this.element.setAttribute('aria-label', 'Play');
    this.element.appendChild(svgIcon(Icons.play));
    this.element.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
  }

  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
  }
}
