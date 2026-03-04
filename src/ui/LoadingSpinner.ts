export class LoadingSpinner {
  readonly element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'gallop-spinner';
    this.element.hidden = true;
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-label', 'Loading');

    const ring = document.createElement('div');
    ring.className = 'gallop-spinner-ring';
    this.element.appendChild(ring);
  }

  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
  }
}
