import type { GallopPlayerCore } from '../core/GallopPlayerCore';
import { Icons } from './IconSet';
import { svgIcon } from '../utils/dom';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import { TimeDisplay } from './TimeDisplay';
import { SettingsMenu } from './SettingsMenu';
import { CONTROLS_HIDE_DELAY } from '../constants';
import { supportsFullscreen } from '../utils/device';

export class Controls {
  readonly element: HTMLDivElement;
  private player: GallopPlayerCore;
  private wrapper: HTMLElement;
  private progressBar: ProgressBar;
  private volumeControl: VolumeControl;
  private timeDisplay: TimeDisplay;
  private settingsMenu: SettingsMenu;
  private playPauseBtn: HTMLButtonElement;
  private fullscreenBtn: HTMLButtonElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private playIcon: HTMLElement;
  private pauseIcon: HTMLElement;
  private fsEnterIcon: HTMLElement;
  private fsExitIcon: HTMLElement;

  constructor(player: GallopPlayerCore, wrapper: HTMLElement) {
    this.player = player;
    this.wrapper = wrapper;

    this.element = document.createElement('div');
    this.element.className = 'gallop-controls';

    this.playIcon = svgIcon(Icons.play);
    this.pauseIcon = svgIcon(Icons.pause);
    this.fsEnterIcon = svgIcon(Icons.fullscreen);
    this.fsExitIcon = svgIcon(Icons.fullscreenExit);

    this.progressBar = new ProgressBar(player);

    // Single-row layout: play | time | progress | settings | fullscreen
    const row = document.createElement('div');
    row.className = 'gallop-controls-row';

    // Play/Pause
    this.playPauseBtn = document.createElement('button');
    this.playPauseBtn.className = 'gallop-btn';
    this.playPauseBtn.setAttribute('aria-label', 'Play');
    this.playPauseBtn.appendChild(this.playIcon.cloneNode(true));
    this.playPauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      player.togglePlay();
    });
    row.appendChild(this.playPauseBtn);

    // Time
    this.timeDisplay = new TimeDisplay();
    row.appendChild(this.timeDisplay.element);

    // Progress bar (inline, fills remaining space)
    row.appendChild(this.progressBar.element);

    // Volume
    this.volumeControl = new VolumeControl(player);
    row.appendChild(this.volumeControl.element);

    // Settings
    this.settingsMenu = new SettingsMenu(player);
    const settingsWrap = document.createElement('div');
    settingsWrap.style.position = 'relative';
    settingsWrap.appendChild(this.settingsMenu.element);
    settingsWrap.appendChild(this.settingsMenu.button);
    row.appendChild(settingsWrap);

    // Fullscreen
    if (supportsFullscreen()) {
      this.fullscreenBtn = document.createElement('button');
      this.fullscreenBtn.className = 'gallop-btn';
      this.fullscreenBtn.setAttribute('aria-label', 'Fullscreen');
      this.fullscreenBtn.appendChild(this.fsEnterIcon.cloneNode(true));
      this.fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        player.toggleFullscreen();
      });
      row.appendChild(this.fullscreenBtn);
    }

    this.element.appendChild(row);

    // Bind events
    this.bindEvents();
    this.startHideTimer();
  }

  private bindEvents(): void {
    this.player.on('timeupdate', ({ currentTime, duration }) => {
      this.timeDisplay.update(currentTime, duration);
      this.progressBar.update(currentTime, duration, this.player.buffered);
    });

    this.player.on('volumechange', ({ volume, muted }) => {
      this.volumeControl.update(volume, muted);
    });

    this.player.on('play', () => this.updatePlayPause(true));
    this.player.on('pause', () => this.updatePlayPause(false));
    this.player.on('ended', () => this.updatePlayPause(false));

    this.player.on('qualitylevels', ({ levels }) => {
      this.settingsMenu.setQualityLevels(levels);
    });

    this.player.on('fullscreenchange', ({ isFullscreen }) => {
      if (this.fullscreenBtn) {
        this.fullscreenBtn.innerHTML = '';
        this.fullscreenBtn.appendChild(
          isFullscreen ? this.fsExitIcon.cloneNode(true) : this.fsEnterIcon.cloneNode(true),
        );
      }
    });

    // Auto-hide controls on mouse activity
    this.wrapper.addEventListener('mousemove', this.onActivity);
    this.wrapper.addEventListener('mouseenter', this.onActivity);
    this.wrapper.addEventListener('mouseleave', () => this.hideControls());

    // Toggle play on click (but not on control clicks)
    this.wrapper.addEventListener('click', (e) => {
      if (e.target === this.player.getVideoElement() || e.target === this.wrapper) {
        this.player.togglePlay();
        this.settingsMenu.close();
      }
    });
  }

  private updatePlayPause(playing: boolean): void {
    this.playPauseBtn.innerHTML = '';
    this.playPauseBtn.appendChild(
      playing ? this.pauseIcon.cloneNode(true) : this.playIcon.cloneNode(true),
    );
    this.playPauseBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  private onActivity = (): void => {
    this.showControls();
    this.startHideTimer();
  };

  private showControls(): void {
    this.element.classList.remove('gallop-controls-hidden');
    this.wrapper.style.cursor = '';
  }

  private hideControls(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.element.classList.add('gallop-controls-hidden');
    this.wrapper.style.cursor = 'none';
  }

  private startHideTimer(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hideControls(), CONTROLS_HIDE_DELAY);
  }

  destroy(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.progressBar.destroy();
    this.volumeControl.destroy();
    this.wrapper.removeEventListener('mousemove', this.onActivity);
  }
}
