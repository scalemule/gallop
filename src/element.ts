import { Gallop } from './factory';
import { GallopPlayer, GallopConfig, PlayerStatus } from './types';

const OBSERVED_ATTRS = [
  'video-id', 
  'api-key', 
  'embed-token',
  'mode',
  'src', 
  'poster', 
  'autoplay', 
  'muted', 
  'loop', 
  'controls', 
  'aspect-ratio', 
  'nonce',
  'debug'
] as const;

class GallopPlayerElement extends HTMLElement {
  private player: GallopPlayer | null = null;
  private shadowContainer: HTMLDivElement | null = null;

  static get observedAttributes() {
    return [...OBSERVED_ATTRS];
  }

  connectedCallback() {
    if (this.player) return;

    const shadow = this.attachShadow({ mode: 'open' });
    this.shadowContainer = document.createElement('div');
    this.shadowContainer.style.width = '100%';
    this.shadowContainer.style.height = '100%';
    shadow.appendChild(this.shadowContainer);

    this.initializePlayer();
  }

  private initializePlayer() {
    this.player?.destroy();
    this.player = Gallop.create(this.shadowContainer!, this.buildConfig());
    this.bindEvents();
  }

  private bindEvents() {
    if (!this.player) return;

    const events = [
      'ready', 'play', 'pause', 'ended', 'timeupdate', 
      'volumechange', 'qualitychange', 'qualitylevels', 
      'buffering', 'seeked', 'ratechange', 'fullscreenchange', 
      'statuschange', 'error', 'destroy'
    ];

    events.forEach(event => {
      this.player!.on(event as any, (data: any) => {
        this.dispatchEvent(new CustomEvent(`gallop-${event}`, {
          detail: data,
          bubbles: false,
          composed: true
        }));
      });
    });
  }

  disconnectedCallback() {
    this.player?.destroy();
    this.player = null;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue || !this.player) return;

    // Certain attributes trigger full re-initialization
    const triggerReinit = ['video-id', 'api-key', 'embed-token', 'mode', 'src'];
    if (triggerReinit.includes(name)) {
      this.initializePlayer();
    } else {
      // Smart attribute updates
      this.updatePlayerProperty(name, newValue);
    }
  }

  private updatePlayerProperty(name: string, value: string | null) {
    if (!this.player) return;
    switch (name) {
      case 'muted': this.player.muted = value !== null; break;
      case 'autoplay': /* no-op after init */ break;
      case 'loop': /* TODO: add loop to GallopPlayer */ break;
      case 'poster': /* TODO: add updatePoster to GallopPlayer */ break;
    }
  }

  private buildConfig(): GallopConfig {
    const config: GallopConfig = {};

    config.videoId = this.getAttribute('video-id') || undefined;
    config.apiKey = this.getAttribute('api-key') || undefined;
    config.embedToken = this.getAttribute('embed-token') || undefined;
    config.mode = (this.getAttribute('mode') as any) || 'inline';
    config.src = this.getAttribute('src') || undefined;
    config.poster = this.getAttribute('poster') || undefined;
    config.autoplay = this.hasAttribute('autoplay');
    config.muted = this.hasAttribute('muted');
    config.loop = this.hasAttribute('loop');
    config.controls = !this.hasAttribute('no-controls');
    config.aspectRatio = this.getAttribute('aspect-ratio') || undefined;
    config.nonce = this.getAttribute('nonce') || undefined;
    config.debug = this.hasAttribute('debug');

    return config;
  }

  // --- Public API Passthrough ---

  play() { return this.player?.play(); }
  pause() { return this.player?.pause(); }
  seek(time: number) { return this.player?.seek(time); }
  setQualityLevel(index: number) { return this.player?.setQualityLevel(index); }
  setAutoQuality() { return this.player?.setAutoQuality(); }
  toggleFullscreen() { return this.player?.toggleFullscreen(); }
  getQualityLevels() { return this.player?.getQualityLevels() ?? []; }
  getCurrentQuality() { return this.player?.getCurrentQuality() ?? -1; }
  query<K extends keyof import('./types').GallopQueryMap>(key: K) { return this.player?.query(key); }

  get currentTime() { return this.player?.currentTime ?? 0; }
  set currentTime(t: number) { void this.player?.seek(t); }

  get duration() { return this.player?.duration ?? 0; }
  get volume() { return this.player?.volume ?? 1; }
  set volume(v: number) { if (this.player) this.player.volume = v; }

  get muted() { return this.player?.muted ?? false; }
  set muted(m: boolean) { if (this.player) this.player.muted = m; }

  get playbackRate() { return this.player?.playbackRate ?? 1; }
  set playbackRate(r: number) { if (this.player) this.player.playbackRate = r; }

  get isFullscreen() { return this.player?.isFullscreen ?? false; }
  get status() { return this.player?.status ?? 'loading'; }
  get paused() { return this.player?.paused ?? true; }

  getDiagnostics() { return this.player?.getDiagnostics(); }
}

if (typeof customElements !== 'undefined' && !customElements.get('gallop-player')) {
  customElements.define('gallop-player', GallopPlayerElement);
}

export { GallopPlayerElement };
