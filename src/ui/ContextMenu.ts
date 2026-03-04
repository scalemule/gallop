import { el } from '../utils/dom';

interface ContextMenuItem {
  label: string;
  action: () => void;
}

export class ContextMenu {
  readonly element: HTMLElement;
  private items: ContextMenuItem[];
  private onHide: (() => void) | null = null;

  constructor(private wrapper: HTMLElement, pageUrl?: string) {
    // Use explicit pageUrl (passed from host via config), else current location
    const resolvedUrl = pageUrl || window.location.href;

    this.items = [
      {
        label: 'About ScaleMule Gallop',
        action: () => {
          window.open('https://www.scalemule.com/gallop', '_blank', 'noopener');
        },
      },
      {
        label: 'Report a problem',
        action: () => {
          const encoded = encodeURIComponent(resolvedUrl);
          window.open(
            `https://www.scalemule.com/gallop/report?url=${encoded}`,
            '_blank',
            'noopener',
          );
        },
      },
      {
        label: 'Copy link',
        action: () => {
          navigator.clipboard?.writeText(resolvedUrl).catch(() => {
            // Fallback for older browsers
            const input = document.createElement('input');
            input.value = resolvedUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
          });
        },
      },
    ];

    this.element = el('div', { class: 'gallop-context-menu' });
    this.element.hidden = true;

    for (const item of this.items) {
      const row = el('div', { class: 'gallop-context-menu-item' });
      row.textContent = item.label;
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        item.action();
        this.hide();
      });
      this.element.appendChild(row);
    }

    this.wrapper.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('click', this.handleDocumentClick);
    document.addEventListener('contextmenu', this.handleDocumentContext);
  }

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    const rect = this.wrapper.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    this.element.hidden = false;

    // Adjust if menu would overflow right or bottom
    const menuRect = this.element.getBoundingClientRect();
    if (x + menuRect.width > rect.width) {
      x = rect.width - menuRect.width - 4;
    }
    if (y + menuRect.height > rect.height) {
      y = rect.height - menuRect.height - 4;
    }

    this.element.style.left = `${Math.max(4, x)}px`;
    this.element.style.top = `${Math.max(4, y)}px`;
  };

  private handleDocumentClick = (): void => {
    this.hide();
  };

  private handleDocumentContext = (e: MouseEvent): void => {
    // Hide if right-click is outside our wrapper
    if (!this.wrapper.contains(e.target as Node)) {
      this.hide();
    }
  };

  hide(): void {
    this.element.hidden = true;
  }

  destroy(): void {
    this.wrapper.removeEventListener('contextmenu', this.handleContextMenu);
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('contextmenu', this.handleDocumentContext);
    this.element.remove();
  }
}
