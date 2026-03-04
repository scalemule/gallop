export class ErrorOverlay {
  readonly element: HTMLDivElement;
  private messageEl: HTMLDivElement;

  constructor(onRetry: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'gallop-error';
    this.element.hidden = true;

    this.messageEl = document.createElement('div');
    this.messageEl.className = 'gallop-error-message';
    this.messageEl.textContent = 'An error occurred during playback.';
    this.element.appendChild(this.messageEl);

    const retryBtn = document.createElement('button');
    retryBtn.className = 'gallop-error-retry';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRetry();
    });
    this.element.appendChild(retryBtn);
  }

  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
  }

  setMessage(message: string): void {
    this.messageEl.textContent = message;
  }
}
