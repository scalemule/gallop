import type {
  GallopConfig,
  GallopEngineStats,
  QualityLevel,
  GallopPlayer,
  GallopDiagnostics,
  GallopQueryMap,
} from '../types';
import { DEFAULT_CONFIG, DEFAULT_THEME, SPEED_PRESETS } from '../constants';
import { EventEmitter } from './EventEmitter';
import { PlayerState } from './PlayerState';
import { createEngine } from '../engine/engineFactory';
import type { IStreamingEngine } from '../engine/StreamingEngine';
import { ScaleMuleClient } from '../api/ScaleMuleClient';
import { Controls } from '../ui/Controls';
import { BigPlayButton } from '../ui/BigPlayButton';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorOverlay } from '../ui/ErrorOverlay';
import { PosterImage } from '../ui/PosterImage';
import { ContextMenu } from '../ui/ContextMenu';
import { ThemeManager } from '../theme/ThemeManager';
import { KeyboardManager } from '../input/KeyboardManager';
import { TouchManager } from '../input/TouchManager';
import { clamp } from '../utils/time';
import { PLAYER_STYLES } from '../theme/styles';
import { AnalyticsCollector } from '../analytics/AnalyticsCollector';
import { resolveNonce, detectCSPFailure } from '../utils/csp';
import { DebugOverlay } from '../debug/DebugOverlay';
import { GALLOP_VERSION } from '../version';

export class GallopPlayerCore extends EventEmitter implements GallopPlayer {
  private container: HTMLElement;
  private config: GallopConfig;
  private video!: HTMLVideoElement;
  private wrapper!: HTMLElement;
  private engine: IStreamingEngine | null = null;
  private state: PlayerState;
  private client: ScaleMuleClient | null = null;
  private controls: Controls | null = null;
  private bigPlayButton: BigPlayButton | null = null;
  private loadingSpinner: LoadingSpinner | null = null;
  private errorOverlay: ErrorOverlay | null = null;
  private posterImage: PosterImage | null = null;
  private themeManager: ThemeManager;
  private contextMenu: ContextMenu | null = null;
  private keyboardManager: KeyboardManager | null = null;
  private touchManager: TouchManager | null = null;
  private analyticsCollector: AnalyticsCollector | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private debugOverlay: DebugOverlay | null = null;
  private cspStatus: string = 'pending';
  private nonceStatus: string = 'none';
  private destroyed = false;
  private engineStats: GallopEngineStats | null = null;

  constructor(container: HTMLElement, config: GallopConfig = {}) {
    super();
    this.container = container;
    this.config = config;

    this.state = new PlayerState((status) => {
      this.emit('statuschange', { status });
      this.updateUIState();
    });

    this.themeManager = new ThemeManager({ ...DEFAULT_THEME, ...config.theme });

    if (config.apiKey || config.embedToken) {
      this.client = new ScaleMuleClient({
        apiKey: config.apiKey,
        embedToken: config.embedToken,
        baseUrl: config.apiBaseUrl,
      });
    }

    this.createDOM();
    this.bindVideoEvents();

    if (config.controls !== false) {
      this.mountUI();
    }

    if (config.keyboard !== false) {
      this.keyboardManager = new KeyboardManager(this);
    }

    if (config.touch !== false) {
      this.touchManager = new TouchManager(this, this.wrapper);
    }

    this.initializeAnalytics();

    if (this.config.debug) {
      this.initializeDebugOverlay();
    }

    if (config.videoId && this.client) {
      void this.loadVideoById(config.videoId);
    } else if (config.src) {
      void this.loadSource(config.src);
    }
  }

  // --- DOM Setup ---

  private createDOM(): void {
    this.styleEl = document.createElement('style');

    const nonce = resolveNonce(this.config.nonce);
    if (nonce) {
      this.styleEl.nonce = nonce;
      this.nonceStatus = this.config.nonce ? 'explicit' : 'auto';
    }

    this.styleEl.textContent = PLAYER_STYLES;
    this.container.appendChild(this.styleEl);

    detectCSPFailure(this.styleEl, (msg) => {
      this.cspStatus = 'blocked';
      this.emit('error', { code: 'CSP_BLOCKED', message: msg });
    });

    if (this.cspStatus === 'pending') {
      this.cspStatus = 'applied';
    }

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'gallop-player';
    this.wrapper.setAttribute('tabindex', '0');

    this.themeManager.apply(this.wrapper);

    const aspectRatio = this.config.aspectRatio ?? DEFAULT_CONFIG.aspectRatio;
    const [w, h] = aspectRatio.split(':').map(Number);
    if (w && h) {
      this.wrapper.style.aspectRatio = `${w} / ${h}`;
    }

    this.video = document.createElement('video');
    this.video.className = 'gallop-video';
    this.video.playsInline = true;
    this.video.preload = 'metadata';

    if (this.config.muted ?? DEFAULT_CONFIG.muted) {
      this.video.muted = true;
    }
    if (this.config.loop ?? DEFAULT_CONFIG.loop) {
      this.video.loop = true;
    }

    this.wrapper.appendChild(this.video);
    this.container.appendChild(this.wrapper);
  }

  private mountUI(): void {
    this.posterImage = new PosterImage();
    this.wrapper.appendChild(this.posterImage.element);

    this.bigPlayButton = new BigPlayButton(() => this.togglePlay());
    this.wrapper.appendChild(this.bigPlayButton.element);

    this.loadingSpinner = new LoadingSpinner();
    this.wrapper.appendChild(this.loadingSpinner.element);

    this.errorOverlay = new ErrorOverlay(() => this.retry());
    this.wrapper.appendChild(this.errorOverlay.element);

    this.controls = new Controls(this, this.wrapper);
    this.wrapper.appendChild(this.controls.element);

    this.contextMenu = new ContextMenu(this.wrapper, this.config.pageUrl);
    this.wrapper.appendChild(this.contextMenu.element);

    // Brand watermark
    const brand = document.createElement('div');
    brand.className = 'gallop-brand';
    const dot = document.createElement('span');
    dot.className = 'gallop-brand-dot';
    brand.appendChild(dot);
    brand.appendChild(document.createTextNode('Gallop'));
    this.wrapper.appendChild(brand);

    if (this.config.poster) {
      this.posterImage.show(this.config.poster);
    }
    if (this.config.preview && this.posterImage) {
      this.posterImage.setPreview(this.config.preview);
    }
  }

  private bindVideoEvents(): void {
    const v = this.video;

    v.addEventListener('play', () => {
      this.state.transition('playing');
      this.emit('play');
    });

    v.addEventListener('pause', () => {
      if (!this.state.isEnded) {
        this.state.transition('paused');
        this.emit('pause');
      }
    });

    v.addEventListener('ended', () => {
      this.state.transition('ended');
      this.emit('ended');
    });

    v.addEventListener('timeupdate', () => {
      this.emit('timeupdate', {
        currentTime: v.currentTime,
        duration: v.duration,
      });
    });

    v.addEventListener('volumechange', () => {
      this.emit('volumechange', {
        volume: v.volume,
        muted: v.muted,
      });
    });

    v.addEventListener('waiting', () => {
      this.state.transition('buffering');
      this.emit('buffering', { isBuffering: true });
    });

    v.addEventListener('playing', () => {
      this.state.transition('playing');
      this.emit('buffering', { isBuffering: false });
    });

    v.addEventListener('canplay', () => {
      if (this.state.status === 'loading') {
        this.state.transition('ready');
        this.emit('ready');
        if (this.config.autoplay ?? DEFAULT_CONFIG.autoplay) {
          this.play();
        }
      }
    });

    v.addEventListener('error', () => {
      const err = v.error;
      this.state.transition('error');
      this.emit('error', {
        code: `MEDIA_ERR_${err?.code ?? 0}`,
        message: err?.message ?? 'Playback error',
      });
    });

    v.addEventListener('ratechange', () => {
      this.emit('ratechange', { rate: v.playbackRate });
    });
  }

  // --- Loading ---

  async loadVideoById(videoId: string): Promise<void> {
    if (!this.client) {
      this.emit('error', { code: 'NO_API_KEY', message: 'API key required to load video by ID' });
      return;
    }

    this.state.transition('loading');
    this.analyticsCollector?.setVideoId(videoId);

    try {
      const metadata = await this.client.getVideoMetadata(videoId);
      if (metadata.poster && this.posterImage) {
        this.posterImage.show(metadata.poster);
      }
      if (this.posterImage) {
        this.posterImage.setPreview(metadata.preview ?? null);
      }
      this.loadSource(metadata.playlistUrl);
    } catch (err) {
      this.state.transition('error');
      this.emit('error', {
        code: 'API_ERROR',
        message: err instanceof Error ? err.message : 'Failed to load video',
      });
    }
  }

  loadSource(url: string): Promise<void> {
    this.state.transition('loading');

    try {
      this.engine?.destroy();
      this.engine = createEngine(
        { apiKey: this.config.apiKey, embedToken: this.config.embedToken },
        this.config.hlsConfig,
        url,
        this.config.mimeType,
      );

      this.engine.on('qualitylevels', (levels) => {
        this.emit('qualitylevels', { levels: levels as QualityLevel[] });
      });

      this.engine.on('qualitychange', (level) => {
        this.emit('qualitychange', { level: level as QualityLevel });
      });

      this.engine.on('error', (err) => {
        const e = err as { code: string; message: string };
        this.state.transition('error');
        this.emit('error', e);
      });

      this.engine.on('stats', (stats) => {
        const s = stats as GallopEngineStats;
        this.engineStats = s;
        this.analyticsCollector?.onEngineStats(s);
        this.emit('enginestats', { stats: s });
      });

      this.engine.load(url, this.video);

      if (this.config.startTime) {
        this.video.currentTime = this.config.startTime;
      }
      return Promise.resolve();
    } catch (err) {
      this.state.transition('error');
      this.emit('error', {
        code: 'ENGINE_ERROR',
        message: err instanceof Error ? err.message : 'Failed to initialize player',
      });
      return Promise.reject(err);
    }
  }

  // --- Diagnostics & Debug ---

  getDiagnostics(): GallopDiagnostics {
    return {
      version: GALLOP_VERSION,
      mode: 'inline',
      engineType: this.engine?.constructor.name || 'none',
      bitrate: this.engineStats?.bandwidthEstimate || 0,
      bufferLength: this.getBufferLength(),
      fps: this.engineStats?.totalFrames || 0, // Simplified
      droppedFrames: this.engineStats?.droppedFrames || 0,
      totalFrames: this.engineStats?.totalFrames || 0,
      status: this.state.status,
      isMuted: this.video.muted,
      volume: this.video.volume,
      playbackRate: this.video.playbackRate,
      currentTime: this.video.currentTime,
      duration: this.video.duration,
      nonceStatus: this.nonceStatus,
      cspStatus: this.cspStatus,
    };
  }

  private getBufferLength(): number {
    const time = this.video.currentTime;
    const buffered = this.video.buffered;
    for (let i = 0; i < buffered.length; i++) {
      if (time >= buffered.start(i) && time <= buffered.end(i)) {
        return buffered.end(i) - time;
      }
    }
    return 0;
  }

  async query<K extends keyof GallopQueryMap>(key: K): Promise<GallopQueryMap[K]> {
    switch (key) {
      case 'currentTime': return this.video.currentTime as any;
      case 'duration': return this.video.duration as any;
      case 'volume': return this.video.volume as any;
      case 'muted': return this.video.muted as any;
      case 'playbackRate': return this.video.playbackRate as any;
      case 'status': return this.state.status as any;
      case 'isFullscreen': return this.isFullscreen as any;
      case 'currentQuality': return this.getCurrentQuality() as any;
      case 'qualityLevels': return this.getQualityLevels() as any;
      case 'diagnostics': return this.getDiagnostics() as any;
      default:
        return Promise.reject(new Error(`Unknown query key: ${key}`));
    }
  }

  private initializeDebugOverlay(): void {
    const diag = this.getDiagnostics();
    this.debugOverlay = new DebugOverlay(
      this.wrapper,
      {
        version: diag.version,
        mode: diag.mode,
        engineType: diag.engineType,
        nonceStatus: diag.nonceStatus,
        cspStatus: diag.cspStatus,
      },
      () => this.getDiagnostics()
    );
  }

  private retry(): void {
    if (this.config.videoId && this.client) {
      void this.loadVideoById(this.config.videoId);
    } else if (this.config.src) {
      void this.loadSource(this.config.src);
    }
  }

  // --- Playback Controls ---

  async play(): Promise<void> {
    try {
      this.posterImage?.hide();
      await this.video.play();
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          this.analyticsCollector?.trackEvent('error', this.currentTime, {
            event_subtype: 'autoplay_blocked',
            error_code: 'AUTOPLAY_BLOCKED',
            error_message: err.message,
          });
        }

        if (err.name !== 'AbortError') {
          this.emit('error', { code: 'PLAY_FAILED', message: err.message });
        }
      }
    }
  }

  pause(): Promise<void> {
    this.video.pause();
    return Promise.resolve();
  }

  togglePlay(): Promise<void> {
    if (this.video.paused || this.video.ended) {
      return this.play();
    } else {
      return this.pause();
    }
  }

  seek(time: number): Promise<void> {
    const t = clamp(time, 0, this.duration);
    this.video.currentTime = t;
    this.emit('seeked', { time: t });
    return Promise.resolve();
  }

  seekForward(seconds = 5): void {
    void this.seek(this.currentTime + seconds);
  }

  seekBackward(seconds = 5): void {
    void this.seek(this.currentTime - seconds);
  }

  // --- Volume ---

  get volume(): number {
    return this.video.volume;
  }

  set volume(v: number) {
    this.video.volume = clamp(v, 0, 1);
  }

  get muted(): boolean {
    return this.video.muted;
  }

  set muted(m: boolean) {
    this.video.muted = m;
  }

  toggleMute(): void {
    this.video.muted = !this.video.muted;
  }

  // --- Time ---

  get currentTime(): number {
    return this.video.currentTime;
  }

  get duration(): number {
    return this.video.duration || 0;
  }

  get paused(): boolean {
    return this.video.paused;
  }

  get buffered(): TimeRanges {
    return this.video.buffered;
  }

  // --- Quality ---

  getQualityLevels(): QualityLevel[] {
    return this.engine?.getQualityLevels() ?? [];
  }

  setQualityLevel(index: number): Promise<void> {
    this.engine?.setQualityLevel(index);
    return Promise.resolve();
  }

  setAutoQuality(): Promise<void> {
    this.engine?.setAutoQuality();
    return Promise.resolve();
  }

  isAutoQuality(): boolean {
    return this.engine?.isAutoQuality() ?? true;
  }

  getCurrentQuality(): number {
    return this.engine?.getCurrentQuality() ?? -1;
  }

  // --- Playback Rate ---

  get playbackRate(): number {
    return this.video.playbackRate;
  }

  set playbackRate(rate: number) {
    if (SPEED_PRESETS.includes(rate as typeof SPEED_PRESETS[number])) {
      this.video.playbackRate = rate;
    }
  }

  // --- Fullscreen ---

  async toggleFullscreen(): Promise<void> {
    const fsEl = document.fullscreenElement
      ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement;

    if (fsEl) {
      await this.exitFullscreen();
    } else {
      await this.enterFullscreen();
    }
  }

  async enterFullscreen(): Promise<void> {
    const el = this.wrapper as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
      this.wrapper.classList.add('gallop-fullscreen');
      this.emit('fullscreenchange', { isFullscreen: true });
    } catch {
      // Fullscreen request denied
    }
  }

  async exitFullscreen(): Promise<void> {
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
      this.wrapper.classList.remove('gallop-fullscreen');
      this.emit('fullscreenchange', { isFullscreen: false });
    } catch {
      // Fullscreen exit failed
    }
  }

  get isFullscreen(): boolean {
    const fsEl = document.fullscreenElement
      ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement;
    return fsEl === this.wrapper;
  }

  // --- State ---

  get status() {
    return this.state.status;
  }

  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  getWrapperElement(): HTMLElement {
    return this.wrapper;
  }

  // --- UI Updates ---

  private updateUIState(): void {
    const status = this.state.status;

    this.bigPlayButton?.setVisible(status === 'idle' || status === 'ready' || status === 'paused' || status === 'ended');
    this.bigPlayButton?.setMode(status === 'ended' ? 'replay' : 'play');
    this.loadingSpinner?.setVisible(status === 'loading' || status === 'buffering');
    this.errorOverlay?.setVisible(status === 'error');

    if (status === 'playing') {
      this.posterImage?.hide();
    }

    this.wrapper.setAttribute('data-status', status);
  }

  // --- Cleanup ---

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.keyboardManager?.destroy();
    this.touchManager?.destroy();
    this.contextMenu?.destroy();
    this.controls?.destroy();
    this.posterImage?.destroy();
    void this.analyticsCollector?.destroy();
    this.engine?.destroy();
    this.state.reset();
    this.emit('destroy');
    this.removeAllListeners();

    this.wrapper.remove();
    this.styleEl?.remove();
  }

  private initializeAnalytics(): void {
    const analyticsConfig = this.config.analytics;
    const enabled = analyticsConfig?.enabled ?? true;
    if (!enabled || !this.client) {
      return;
    }

    const videoId = analyticsConfig?.videoId ?? this.config.videoId;
    if (!videoId) {
      if (analyticsConfig?.debug) {
        console.warn('[Gallop analytics] disabled: no videoId available');
      }
      return;
    }

    this.analyticsCollector = new AnalyticsCollector({
      client: this.client,
      player: this,
      videoId,
      config: analyticsConfig,
    });
  }
}
