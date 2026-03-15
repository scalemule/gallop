export class PosterImage {
  readonly element: HTMLDivElement;
  private posterUrl: string | null = null;
  private previewUrl: string | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'gallop-poster';
    this.element.hidden = true;
  }

  show(url: string): void {
    this.posterUrl = url;
    this.element.style.backgroundImage = `url("${url.replace(/"/g, '\\"')}")`;
    this.element.hidden = false;
  }

  setPreview(url: string | null): void {
    // Remove old listeners before rebinding (idempotent for fresh instances)
    this.element.removeEventListener('mouseenter', this.handleMouseEnter);
    this.element.removeEventListener('mouseleave', this.handleMouseLeave);

    this.previewUrl = url;

    if (!url) return;

    // Preload so first hover is instant
    const img = new Image();
    img.src = url;
    this.element.addEventListener('mouseenter', this.handleMouseEnter);
    this.element.addEventListener('mouseleave', this.handleMouseLeave);
  }

  private handleMouseEnter = (): void => {
    if (this.previewUrl) {
      this.element.style.backgroundImage = `url("${this.previewUrl.replace(/"/g, '\\"')}")`;
    }
  };

  private handleMouseLeave = (): void => {
    if (this.posterUrl) {
      this.element.style.backgroundImage = `url("${this.posterUrl.replace(/"/g, '\\"')}")`;
    }
  };

  hide(): void {
    this.element.hidden = true;
  }

  destroy(): void {
    this.element.removeEventListener('mouseenter', this.handleMouseEnter);
    this.element.removeEventListener('mouseleave', this.handleMouseLeave);
  }
}
