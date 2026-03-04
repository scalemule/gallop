import type { GallopPlayerCore } from '../core/GallopPlayerCore';
import { Icons } from './IconSet';
import { svgIcon } from '../utils/dom';

export class VolumeControl {
  readonly element: HTMLDivElement;
  private muteBtn: HTMLButtonElement;
  private sliderWrap: HTMLDivElement;
  private slider: HTMLDivElement;
  private fill: HTMLDivElement;
  private player: GallopPlayerCore;
  private iconHigh: HTMLElement;
  private iconLow: HTMLElement;
  private iconMuted: HTMLElement;

  constructor(player: GallopPlayerCore) {
    this.player = player;

    this.element = document.createElement('div');
    this.element.className = 'gallop-volume';

    this.muteBtn = document.createElement('button');
    this.muteBtn.className = 'gallop-btn';
    this.muteBtn.setAttribute('aria-label', 'Mute');

    this.iconHigh = svgIcon(Icons.volumeHigh);
    this.iconLow = svgIcon(Icons.volumeLow);
    this.iconMuted = svgIcon(Icons.volumeMuted);
    this.muteBtn.appendChild(this.iconHigh);

    this.muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      player.toggleMute();
    });

    this.sliderWrap = document.createElement('div');
    this.sliderWrap.className = 'gallop-volume-slider-wrap';

    this.slider = document.createElement('div');
    this.slider.className = 'gallop-volume-slider';

    this.fill = document.createElement('div');
    this.fill.className = 'gallop-volume-fill';
    this.fill.style.width = `${player.volume * 100}%`;

    this.slider.appendChild(this.fill);
    this.sliderWrap.appendChild(this.slider);

    this.element.appendChild(this.muteBtn);
    this.element.appendChild(this.sliderWrap);

    this.slider.addEventListener('mousedown', this.onSliderMouseDown);
  }

  update(volume: number, muted: boolean): void {
    const effectiveVolume = muted ? 0 : volume;
    this.fill.style.width = `${effectiveVolume * 100}%`;

    this.muteBtn.innerHTML = '';
    if (muted || volume === 0) {
      this.muteBtn.appendChild(this.iconMuted.cloneNode(true));
    } else if (volume < 0.5) {
      this.muteBtn.appendChild(this.iconLow.cloneNode(true));
    } else {
      this.muteBtn.appendChild(this.iconHigh.cloneNode(true));
    }
  }

  private onSliderMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    this.setVolumeFromX(e.clientX);

    const onMove = (ev: MouseEvent) => this.setVolumeFromX(ev.clientX);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  private setVolumeFromX(clientX: number): void {
    const rect = this.slider.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    this.player.volume = pct;
    if (this.player.muted && pct > 0) {
      this.player.muted = false;
    }
  }

  destroy(): void {
    this.slider.removeEventListener('mousedown', this.onSliderMouseDown);
  }
}
