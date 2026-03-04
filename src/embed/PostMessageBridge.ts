import { GallopPlayer, GallopQueryMap } from '../types';
import { GALLOP_VERSION } from '../version';

export interface GallopMessage {
  type: string;
  version: number;
  [key: string]: unknown;
}

const MAX_MESSAGE_BYTES = 65536;
type AllowedMethod =
  | 'play'
  | 'pause'
  | 'seek'
  | 'setQualityLevel'
  | 'setAutoQuality'
  | 'toggleFullscreen'
  | 'setVolume'
  | 'setMuted'
  | 'setPlaybackRate'
  | 'query'
  | 'getQualityLevels'
  | 'getCurrentQuality'
  | 'getDiagnostics';

const ALLOWED_METHODS = new Set<AllowedMethod>([
  'play',
  'pause',
  'seek',
  'setQualityLevel',
  'setAutoQuality',
  'toggleFullscreen',
  'setVolume',
  'setMuted',
  'setPlaybackRate',
  'query',
  'getQualityLevels',
  'getCurrentQuality',
  'getDiagnostics',
]);

const ALLOWED_QUERY_KEYS = new Set<keyof GallopQueryMap>([
  'currentTime',
  'duration',
  'volume',
  'muted',
  'playbackRate',
  'status',
  'isFullscreen',
  'currentQuality',
  'qualityLevels',
  'diagnostics',
]);

export class PostMessageBridge {
  private targetOrigin: string | null = null;
  private isConnected = false;
  private version = 1;
  private stateInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private player: GallopPlayer) {
    window.addEventListener('message', (event) => this.handleMessage(event));

    // Send unsolicited hello on load
    this.sendMessage({ type: 'gallop:hello', version: this.version }, '*');
  }

  private handleMessage(event: MessageEvent) {
    const data = event.data as GallopMessage;
    if (!data || typeof data.type !== 'string') return;

    // Source validation: ALL messages must come from our parent window
    if (event.source !== window.parent) return;

    // Handshake: gallop:ping
    if (data.type === 'gallop:ping') {
      this.handlePing(event);
      return;
    }

    // After handshake: strict origin validation
    if (!this.isConnected || event.origin !== this.targetOrigin) {
      return;
    }

    if (data.type === 'gallop:method') {
      void this.handleMethod(data);
    }
  }

  private handlePing(event: MessageEvent) {
    const data = event.data;
    if (this.isConnected) return;

    // Lock origin after first valid ping
    this.targetOrigin = event.origin;
    this.isConnected = true;

    this.sendMessage({
      type: 'gallop:pong',
      version: this.version,
      playerVersion: GALLOP_VERSION,
      capabilities: ['fullscreen', 'quality', 'pip', 'state-snapshot'],
      sessionId: data.sessionId || 'anonymous',
      diagnostics: this.player.getDiagnostics(),
    });

    this.setupEvents();
    this.setupStateReporting();
  }

  private async handleMethod(data: GallopMessage) {
    const method = data.method as string;
    const args = Array.isArray(data.args) ? data.args : [];
    const callId = data.callId as string;

    if (typeof callId !== 'string' || !callId) {
      return;
    }

    if (!this.isAllowedMethod(method)) {
      this.sendMethodResponse(callId, null, {
        code: 'UNKNOWN_METHOD',
        message: `Method ${method} not allowed`,
      });
      return;
    }

    try {
      const result = await this.invokeMethod(method, args);
      this.sendMethodResponse(callId, result ?? null, null);
    } catch (err) {
      this.sendMethodResponse(callId, null, {
        code: 'METHOD_ERROR',
        message: err instanceof Error ? err.message : 'Internal error',
      });
    }
  }

  private isAllowedMethod(method: string): method is AllowedMethod {
    return ALLOWED_METHODS.has(method as AllowedMethod);
  }

  private toFiniteNumber(value: unknown, label: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Invalid ${label}`);
    }
    return value;
  }

  private async invokeMethod(method: AllowedMethod, args: unknown[]): Promise<unknown> {
    switch (method) {
      case 'play':
        return this.player.play();
      case 'pause':
        return this.player.pause();
      case 'seek':
        return this.player.seek(this.toFiniteNumber(args[0], 'seek time'));
      case 'setQualityLevel':
        return this.player.setQualityLevel(Math.trunc(this.toFiniteNumber(args[0], 'quality level')));
      case 'setAutoQuality':
        return this.player.setAutoQuality();
      case 'toggleFullscreen':
        return this.player.toggleFullscreen();
      case 'setVolume':
        this.player.volume = this.toFiniteNumber(args[0], 'volume');
        return null;
      case 'setMuted': {
        if (typeof args[0] !== 'boolean') {
          throw new Error('Invalid muted value');
        }
        this.player.muted = args[0];
        return null;
      }
      case 'setPlaybackRate':
        this.player.playbackRate = this.toFiniteNumber(args[0], 'playback rate');
        return null;
      case 'query': {
        const queryKey = args[0];
        if (
          typeof queryKey !== 'string' ||
          !ALLOWED_QUERY_KEYS.has(queryKey as keyof GallopQueryMap)
        ) {
          throw new Error('Invalid query key');
        }
        return this.player.query(queryKey as keyof GallopQueryMap);
      }
      case 'getQualityLevels':
        return this.player.getQualityLevels();
      case 'getCurrentQuality':
        return this.player.getCurrentQuality();
      case 'getDiagnostics':
        return this.player.getDiagnostics();
    }
  }

  private sendMethodResponse(
    callId: string,
    result: unknown,
    error: { code: string; message: string } | null
  ) {
    this.sendMessage({
      type: 'gallop:response',
      callId,
      result,
      error,
      version: this.version,
    });
  }

  private setupEvents() {
    const events = [
      'ready', 'play', 'pause', 'ended', 'timeupdate',
      'volumechange', 'qualitychange', 'qualitylevels',
      'buffering', 'seeked', 'ratechange', 'fullscreenchange',
      'statuschange', 'error', 'destroy',
    ] as const;

    events.forEach((event) => {
      this.player.on(event as any, (data: any) => {
        this.sendMessage({
          type: 'gallop:event',
          event,
          data: data ?? null,
          version: this.version,
        });
      });
    });
  }

  private setupStateReporting() {
    // Send proper GallopStateSnapshot at 4Hz (250ms)
    this.stateInterval = setInterval(() => {
      if (!this.isConnected) return;
      this.sendMessage({
        type: 'gallop:state',
        state: {
          currentTime: this.player.currentTime,
          duration: this.player.duration,
          paused: this.player.paused,
          volume: this.player.volume,
          muted: this.player.muted,
          playbackRate: this.player.playbackRate,
          status: this.player.status,
          isFullscreen: this.player.isFullscreen,
        },
        version: this.version,
      });
    }, 250);
  }

  private sendMessage(msg: GallopMessage, origin?: string) {
    const target = origin || this.targetOrigin;
    if (!target) return;

    // 64KB size check — silently drop oversized messages
    try {
      const serialized = JSON.stringify(msg);
      if (serialized.length > MAX_MESSAGE_BYTES) return;
    } catch {
      return;
    }

    window.parent.postMessage(msg, target);
  }
}
