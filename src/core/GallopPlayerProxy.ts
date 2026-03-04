import { EventEmitter } from './EventEmitter';
import { 
  GallopPlayer, 
  GallopConfig, 
  GallopDiagnostics, 
  GallopEventMap, 
  GallopEventCallback,
  GallopQueryMap,
  PlayerStatus,
  QualityLevel
} from '../types';
import { GallopPlayerCore } from './GallopPlayerCore';
import { GallopIframeController } from '../iframe/GallopIframeController';

export class GallopPlayerProxy extends EventEmitter implements GallopPlayer {
  private backend: GallopPlayer;
  private isSwapping = false;

  constructor(private container: HTMLElement, private config: GallopConfig) {
    super();
    // Default to inline mode initially
    this.backend = new GallopPlayerCore(container, config);
    this.setupListeners();

    // Listen for CSP failure to trigger fallback
    this.backend.on('error', (err: any) => {
      if (err.code === 'CSP_BLOCKED' && !this.isSwapping) {
        this.fallbackToIframe();
      }
    });
  }

  private setupListeners() {
    const events: (keyof GallopEventMap)[] = [
      'ready', 'play', 'pause', 'ended', 'timeupdate', 
      'volumechange', 'qualitychange', 'qualitylevels', 
      'buffering', 'seeked', 'ratechange', 'fullscreenchange', 
      'statuschange', 'error', 'destroy'
    ];

    events.forEach(event => {
      this.backend.on(event as any, (data: any) => {
        this.emit(event as any, data);
      });
    });
  }

  private fallbackToIframe() {
    this.isSwapping = true;
    console.warn('[Gallop] CSP blocked inline player, falling back to iframe mode');

    // 1. Emit BACKEND_SWITCHED so consumers know in-flight calls will be rejected
    this.emit('error', {
      code: 'BACKEND_SWITCHED',
      message: 'Player backend switched from inline to iframe',
    });

    // 2. Destroy current backend
    this.backend.destroy();

    // 3. Create iframe backend
    this.backend = new GallopIframeController(this.container, this.config);
    this.setupListeners();

    this.emit('system:modefallback' as any, { mode: 'iframe' });
    this.isSwapping = false;
  }

  // --- Delegate GallopPlayer Implementation ---

  get currentTime() { return this.backend.currentTime; }
  get duration() { return this.backend.duration; }
  get paused() { return this.backend.paused; }
  get status() { return this.backend.status; }
  get isFullscreen() { return this.backend.isFullscreen; }

  get volume() { return this.backend.volume; }
  set volume(v: number) { this.backend.volume = v; }

  get muted() { return this.backend.muted; }
  set muted(m: boolean) { this.backend.muted = m; }

  get playbackRate() { return this.backend.playbackRate; }
  set playbackRate(r: number) { this.backend.playbackRate = r; }

  play() { return this.backend.play(); }
  pause() { return this.backend.pause(); }
  seek(time: number) { return this.backend.seek(time); }
  setQualityLevel(index: number) { return this.backend.setQualityLevel(index); }
  setAutoQuality() { return this.backend.setAutoQuality(); }
  toggleFullscreen() { return this.backend.toggleFullscreen(); }

  getQualityLevels() { return this.backend.getQualityLevels(); }
  getCurrentQuality() { return this.backend.getCurrentQuality(); }
  getDiagnostics() { return this.backend.getDiagnostics(); }

  query<K extends keyof GallopQueryMap>(key: K) { return this.backend.query(key); }

  destroy(): void {
    this.backend.destroy();
    this.removeAllListeners();
  }
}
