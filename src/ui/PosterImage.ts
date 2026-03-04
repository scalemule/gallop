export class PosterImage {
  readonly element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'gallop-poster';
    this.element.hidden = true;
  }

  show(url: string): void {
    this.element.style.backgroundImage = `url("${url.replace(/"/g, '\\"')}")`;
    this.element.hidden = false;
  }

  hide(): void {
    this.element.hidden = true;
  }
}
