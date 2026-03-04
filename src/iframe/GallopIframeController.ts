import { EventEmitter } from '../core/EventEmitter';
import {
  GallopPlayer,
  GallopConfig,
  GallopDiagnostics,
  GallopEventMap,
  GallopEventCallback,
  GallopQueryMap,
  PlayerStatus,
  QualityLevel,
} from '../types';

/** Config keys safe to include in the URL hash (no secrets, no auth). */
const HASH_CONFIG_ALLOWLIST: (keyof GallopConfig)[] = [
  'autoplay', 'muted', 'loop', 'controls', 'startTime',
  'preferredQuality', 'aspectRatio', 'theme', 'debug',
  'doNotTrack', 'analytics', 'pageUrl',
];

const MAX_HASH_CONFIG_BYTES = 4096;

function sanitizeConfigForHash(config: GallopConfig): Partial<GallopConfig> {
  const safe: Record<string, unknown> = {};
  for (const key of HASH_CONFIG_ALLOWLIST) {
    if (config[key] !== undefined) {
      safe[key] = config[key];
    }
  }
  return safe as Partial<GallopConfig>;
}

/** State snapshot sent by the iframe at 4Hz via gallop:state */
interface GallopStateSnapshot {
  currentTime: number;
  duration: number;
  paused: boolean;
  volume: number;
  muted: boolean;
  playbackRate: number;
  status: PlayerStatus;
  isFullscreen: boolean;
}

export class GallopIframeController extends EventEmitter implements GallopPlayer {
  private iframe: HTMLIFrameElement;
  private targetOrigin: string | null = null;
  private isConnected = false;
  private pendingCalls = new Map<string, { resolve: Function; reject: Function; timeout: ReturnType<typeof setTimeout> }>();
  private stateCache: Partial<GallopStateSnapshot> = {};
  private cachedQualityLevels: QualityLevel[] = [];
  private cachedCurrentQuality = -1;
  private cachedDiagnostics: Partial<GallopDiagnostics> = {};
  private sessionId: string = Math.random().toString(36).substring(7);
  private boundHandler: (e: MessageEvent) => void;
  private handshakeInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private container: HTMLElement, private config: GallopConfig) {
    super();
    this.iframe = this.createIframe();
    this.container.appendChild(this.iframe);
    this.boundHandler = this.handleMessage.bind(this);
    window.addEventListener('message', this.boundHandler);
    this.startHandshake();
  }

  private createIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    const videoId = this.config.videoId || 'unknown';

    const baseUrl = this.config.apiBaseUrl
      ? `${this.config.apiBaseUrl.replace(/\/$/, '')}/v1/videos/embed`
      : 'https://api.scalemule.com/v1/videos/embed';
    const url = new URL(`${baseUrl}/${videoId}`);
    if (this.config.embedToken) {
      url.searchParams.set('token', this.config.embedToken);
    }

    // Sanitize config — strip apiKey, embedToken, nonce
    const safeConfig = sanitizeConfigForHash(this.config);
    // Auto-inject host page URL so context menu "Copy link" works in iframes
    if (!safeConfig.pageUrl && typeof window !== 'undefined') {
      safeConfig.pageUrl = window.location.href;
    }
    const json = JSON.stringify(safeConfig);
    const encoded = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    if (encoded.length > MAX_HASH_CONFIG_BYTES) {
      // Don't include oversized config — will emit error after handshake
      console.warn('[Gallop] Config too large for hash, using defaults');
    } else {
      url.hash = `config=${encoded}`;
    }

    iframe.src = url.toString();
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    iframe.title = 'Gallop Video Player';

    return iframe;
  }

  private startHandshake() {
    let attempts = 0;
    this.handshakeInterval = setInterval(() => {
      if (this.isConnected || attempts >= 3) {
        if (this.handshakeInterval) clearInterval(this.handshakeInterval);
        this.handshakeInterval = null;
        if (!this.isConnected && attempts >= 3) {
          this.emit('error', { code: 'CONNECT_TIMEOUT', message: 'iframe handshake timed out' });
        }
        return;
      }
      this.sendMessage('gallop:ping', { sessionId: this.sessionId }, '*');
      attempts++;
    }, 1000);
  }

  private handleMessage(event: MessageEvent) {
    const data = event.data;
    if (!data || typeof data.type !== 'string' || !data.type.startsWith('gallop:')) return;

    // Source validation: ALL messages must come from our iframe
    if (event.source !== this.iframe.contentWindow) return;

    // Pre-handshake messages: only accept gallop:hello and gallop:pong
    if (!this.isConnected) {
      if (data.type === 'gallop:hello') {
        this.sendMessage('gallop:ping', { sessionId: this.sessionId }, '*');
        return;
      }
      if (data.type === 'gallop:pong') {
        this.targetOrigin = event.origin;
        this.isConnected = true;
        if (this.handshakeInterval) {
          clearInterval(this.handshakeInterval);
          this.handshakeInterval = null;
        }
        // Cache initial diagnostics from pong if present
        if (data.diagnostics) {
          this.cachedDiagnostics = data.diagnostics;
        }
        // Do NOT emit 'ready' here. Transport readiness (gallop:pong) is not
        // the same as player readiness. The player's 'ready' event will arrive
        // via gallop:event once the embedded GallopPlayerCore is initialized.
        // Host can check the .connected property for transport state.
        return;
      }
      if (data.type === 'gallop:error') {
        this.emit('error', { code: data.code || 'EMBED_LOAD_FAILED', message: data.message || 'Embed error' });
        return;
      }
      // Ignore all other pre-handshake messages
      return;
    }

    // Post-handshake: validate origin matches locked origin
    if (event.origin !== this.targetOrigin) return;

    switch (data.type) {
      case 'gallop:event':
        // Cache quality data from events
        if (data.event === 'qualitylevels' && data.data?.levels) {
          this.cachedQualityLevels = data.data.levels;
        }
        if (data.event === 'qualitychange' && data.data?.level) {
          this.cachedCurrentQuality = data.data.level.index ?? -1;
        }
        this.emit(data.event as keyof GallopEventMap, data.data);
        break;

      case 'gallop:state':
        this.stateCache = data.state;
        break;

      case 'gallop:response':
        this.handleResponse(data);
        break;

      case 'gallop:error':
        this.emit('error', { code: data.code || 'UNKNOWN', message: data.message || 'Unknown error' });
        break;
    }
  }

  private handleResponse(data: { callId: string; result?: unknown; error?: { code: string; message: string } | null }) {
    const call = this.pendingCalls.get(data.callId);
    if (call) {
      clearTimeout(call.timeout);
      if (data.error) {
        call.reject(data.error);
      } else {
        call.resolve(data.result);
      }
      this.pendingCalls.delete(data.callId);
    }
  }

  private sendMessage(type: string, payload: Record<string, unknown> = {}, overrideOrigin?: string) {
    const target = overrideOrigin || this.targetOrigin;
    if (!target) return;
    this.iframe.contentWindow?.postMessage({
      type,
      ...payload,
      version: 1,
    }, target);
  }

  private callMethod(method: string, ...args: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected && method !== 'destroy') {
        reject(new Error('Player not connected'));
        return;
      }

      if (this.pendingCalls.size >= 20) {
        reject(new Error('Too many pending calls'));
        return;
      }

      const callId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      const timeout = setTimeout(() => {
        this.pendingCalls.delete(callId);
        reject(new Error(`Method ${method} timed out`));
      }, 5000);

      this.pendingCalls.set(callId, { resolve, reject, timeout });
      this.sendMessage('gallop:method', { method, args, callId });
    });
  }

  // --- GallopPlayer Implementation ---

  get currentTime() { return this.stateCache.currentTime ?? 0; }
  get duration() { return this.stateCache.duration ?? 0; }
  get paused() { return this.stateCache.paused ?? true; }
  get status() { return (this.stateCache.status as PlayerStatus) ?? 'loading'; }
  get isFullscreen() { return this.stateCache.isFullscreen ?? false; }

  get volume() { return this.stateCache.volume ?? 1; }
  set volume(v: number) { void this.callMethod('setVolume', v); }

  get muted() { return this.stateCache.muted ?? false; }
  set muted(m: boolean) { void this.callMethod('setMuted', m); }

  get playbackRate() { return this.stateCache.playbackRate ?? 1; }
  set playbackRate(r: number) { void this.callMethod('setPlaybackRate', r); }

  play() { return this.callMethod('play') as Promise<void>; }
  pause() { return this.callMethod('pause') as Promise<void>; }
  seek(time: number) { return this.callMethod('seek', time) as Promise<void>; }
  setQualityLevel(index: number) { return this.callMethod('setQualityLevel', index) as Promise<void>; }
  setAutoQuality() { return this.callMethod('setAutoQuality') as Promise<void>; }
  toggleFullscreen() { return this.callMethod('toggleFullscreen') as Promise<void>; }

  getQualityLevels(): QualityLevel[] { return this.cachedQualityLevels; }
  getCurrentQuality(): number { return this.cachedCurrentQuality; }
  getDiagnostics(): GallopDiagnostics { return this.cachedDiagnostics as GallopDiagnostics; }

  query<K extends keyof GallopQueryMap>(key: K): Promise<GallopQueryMap[K]> {
    return this.callMethod('query', key) as Promise<GallopQueryMap[K]>;
  }

  get connected(): boolean { return this.isConnected; }

  destroy(): void {
    if (this.handshakeInterval) {
      clearInterval(this.handshakeInterval);
      this.handshakeInterval = null;
    }
    // Clear all pending calls
    for (const [, call] of this.pendingCalls) {
      clearTimeout(call.timeout);
      call.reject(new Error('Player destroyed'));
    }
    this.pendingCalls.clear();
    window.removeEventListener('message', this.boundHandler);
    this.iframe.remove();
    this.emit('destroy');
    this.removeAllListeners();
  }
}
