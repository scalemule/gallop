import type { GallopPlayerCore } from '../core/GallopPlayerCore';
import type { QualityLevel } from '../types';
import { SPEED_PRESETS } from '../constants';
import { Icons } from './IconSet';
import { svgIcon } from '../utils/dom';

type MenuView = 'main' | 'quality' | 'speed';

export class SettingsMenu {
  readonly element: HTMLDivElement;
  readonly button: HTMLButtonElement;
  private player: GallopPlayerCore;
  private currentView: MenuView = 'main';
  private qualityLevels: QualityLevel[] = [];

  constructor(player: GallopPlayerCore) {
    this.player = player;

    this.button = document.createElement('button');
    this.button.className = 'gallop-btn';
    this.button.setAttribute('aria-label', 'Settings');
    this.button.appendChild(svgIcon(Icons.settings));
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.element = document.createElement('div');
    this.element.className = 'gallop-settings-menu';
    this.element.hidden = true;
    this.element.addEventListener('click', (e) => e.stopPropagation());

    this.renderMain();
  }

  setQualityLevels(levels: QualityLevel[]): void {
    this.qualityLevels = levels;
    if (this.currentView === 'quality') {
      this.renderQuality();
    } else if (this.currentView === 'main') {
      this.renderMain();
    }
  }

  toggle(): void {
    if (this.element.hidden) {
      this.currentView = 'main';
      this.renderMain();
      this.element.hidden = false;
    } else {
      this.element.hidden = true;
    }
  }

  close(): void {
    this.element.hidden = true;
    this.currentView = 'main';
  }

  private renderMain(): void {
    this.element.innerHTML = '';

    const qualityItem = this.createItem('Quality', this.getQualityLabel());
    qualityItem.addEventListener('click', () => {
      this.currentView = 'quality';
      this.renderQuality();
    });

    const speedItem = this.createItem('Speed', this.getSpeedLabel());
    speedItem.addEventListener('click', () => {
      this.currentView = 'speed';
      this.renderSpeed();
    });

    this.element.appendChild(qualityItem);
    this.element.appendChild(speedItem);
  }

  private renderQuality(): void {
    this.element.innerHTML = '';

    const header = this.createHeader('Quality');
    this.element.appendChild(header);

    const autoItem = this.createSelectItem(
      'Auto',
      this.player.isAutoQuality(),
    );
    autoItem.addEventListener('click', () => {
      this.player.setAutoQuality();
      this.close();
    });
    this.element.appendChild(autoItem);

    const sorted = [...this.qualityLevels].sort((a, b) => b.height - a.height);
    for (const level of sorted) {
      const item = this.createSelectItem(
        level.label,
        !this.player.isAutoQuality() && level.index === this.player.getCurrentQuality(),
      );
      item.addEventListener('click', () => {
        this.player.setQualityLevel(level.index);
        this.close();
      });
      this.element.appendChild(item);
    }
  }

  private renderSpeed(): void {
    this.element.innerHTML = '';

    const header = this.createHeader('Speed');
    this.element.appendChild(header);

    for (const speed of SPEED_PRESETS) {
      const label = speed === 1 ? 'Normal' : `${speed}x`;
      const item = this.createSelectItem(label, this.player.playbackRate === speed);
      item.addEventListener('click', () => {
        this.player.playbackRate = speed;
        this.close();
      });
      this.element.appendChild(item);
    }
  }

  private createItem(label: string, value: string): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'gallop-settings-item';

    const labelEl = document.createElement('span');
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'gallop-settings-value';
    valueEl.textContent = value;

    item.appendChild(labelEl);
    item.appendChild(valueEl);
    return item;
  }

  private createSelectItem(label: string, active: boolean): HTMLDivElement {
    const item = document.createElement('div');
    item.className = 'gallop-settings-item' + (active ? ' gallop-settings-item-active' : '');

    if (active) {
      item.appendChild(svgIcon(Icons.check));
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'gallop-icon';
      item.appendChild(spacer);
    }

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    item.appendChild(labelEl);

    return item;
  }

  private createHeader(title: string): HTMLDivElement {
    const header = document.createElement('div');
    header.className = 'gallop-settings-header';
    header.appendChild(svgIcon(Icons.chevronLeft));
    const text = document.createElement('span');
    text.textContent = title;
    header.appendChild(text);
    header.addEventListener('click', () => {
      this.currentView = 'main';
      this.renderMain();
    });
    return header;
  }

  private getQualityLabel(): string {
    if (this.player.isAutoQuality()) {
      const current = this.player.getCurrentQuality();
      const level = this.qualityLevels.find((l) => l.index === current);
      return level ? `Auto (${level.height}p)` : 'Auto';
    }
    const current = this.player.getCurrentQuality();
    const level = this.qualityLevels.find((l) => l.index === current);
    return level?.label ?? 'Auto';
  }

  private getSpeedLabel(): string {
    const rate = this.player.playbackRate;
    return rate === 1 ? 'Normal' : `${rate}x`;
  }
}
