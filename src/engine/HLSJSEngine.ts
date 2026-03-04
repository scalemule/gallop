import Hls from 'hls.js';
import type { GallopEngineStats, QualityLevel } from '../types';
import type { EngineEvent, IStreamingEngine } from './StreamingEngine';
import { HLS_DEFAULT_CONFIG } from '../constants';
import type { EngineAuthOptions } from './StreamingEngine';

export class HLSJSEngine implements IStreamingEngine {
  private hls: Hls | null = null;
  private video: HTMLVideoElement | null = null;
  private levels: QualityLevel[] = [];
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private apiKey?: string;
  private embedToken?: string;
  private hlsConfigOverrides?: Record<string, unknown>;
  private statsTimer: ReturnType<typeof setInterval> | null = null;

  constructor(auth?: EngineAuthOptions, hlsConfigOverrides?: Record<string, unknown>) {
    this.apiKey = auth?.apiKey;
    this.embedToken = auth?.embedToken;
    this.hlsConfigOverrides = hlsConfigOverrides;
  }

  load(url: string, videoElement: HTMLVideoElement): void {
    this.destroy();
    this.video = videoElement;
    let sourceOrigin: string | null = null;
    try {
      sourceOrigin = new URL(url, window.location.href).origin;
    } catch {
      // Keep auth disabled for invalid source URLs.
    }

    const config: Partial<Hls['config']> = {
      ...HLS_DEFAULT_CONFIG,
      ...this.hlsConfigOverrides,
    };

    if (this.apiKey || this.embedToken) {
      const apiKey = this.apiKey;
      const embedToken = this.embedToken;
      config.xhrSetup = (xhr: XMLHttpRequest, requestUrl: string) => {
        try {
          const u = new URL(requestUrl, url);
          const isTrustedOrigin = sourceOrigin !== null && u.origin === sourceOrigin;
          if (apiKey && isTrustedOrigin) {
            xhr.setRequestHeader('X-API-Key', apiKey);
          } else if (embedToken && isTrustedOrigin) {
            // For embed mode, append token as query parameter
            u.searchParams.set('token', embedToken);
            xhr.open('GET', u.toString(), true);
          }
        } catch {
          // Skip auth for unparseable URLs
        }
      };
    }

    this.hls = new Hls(config as object);

    this.hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      this.levels = data.levels.map((level, index) => ({
        index,
        height: level.height,
        width: level.width,
        bitrate: level.bitrate,
        label: `${level.height}p`,
        active: index === this.hls!.currentLevel,
      }));
      this.fire('qualitylevels', this.levels);
    });

    this.hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      this.levels = this.levels.map((level) => ({
        ...level,
        active: level.index === data.level,
      }));
      const activeLevel = this.levels[data.level];
      if (activeLevel) {
        this.fire('qualitychange', activeLevel);
      }
      this.fireStats({
        kind: 'level_switch',
        level: data.level,
        bandwidthEstimate: this.hls?.bandwidthEstimate,
      });
    });

    this.hls.on(Hls.Events.ERROR, (_event, data) => {
      this.fireStats({
        kind: 'hls_error',
        fatal: data.fatal,
        errorType: data.type,
        errorDetails: data.details,
        bandwidthEstimate: this.hls?.bandwidthEstimate,
      });

      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            this.hls!.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            this.hls!.recoverMediaError();
            break;
          default:
            this.fire('error', {
              code: data.type,
              message: data.details || 'Fatal playback error',
            });
            break;
        }
      }
    });

    this.hls.on(Hls.Events.FRAG_BUFFERED, (_event, data) => {
      this.fire('buffering', false);
      const stats = (data as { frag?: { duration?: number }; stats?: { total?: number; loading?: { start?: number; end?: number } } }) ?? {};
      const loadStart = stats.stats?.loading?.start ?? 0;
      const loadEnd = stats.stats?.loading?.end ?? 0;
      this.fireStats({
        kind: 'fragment',
        bandwidthEstimate: this.hls?.bandwidthEstimate,
        fragmentDuration: stats.frag?.duration,
        fragmentSizeBytes: stats.stats?.total,
        fragmentLoadMs: loadEnd > loadStart ? loadEnd - loadStart : undefined,
      });
    });

    this.hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
      const response = data.networkDetails as XMLHttpRequest;
      if (response && typeof response.getResponseHeader === 'function') {
        this.fireStats({
          kind: 'fragment',
          cdnNode: response.getResponseHeader('X-Amz-Cf-Pop') || response.getResponseHeader('X-Edge-Location') || undefined,
          cdnCacheStatus: response.getResponseHeader('X-Cache') || undefined,
          cdnRequestID: response.getResponseHeader('X-Amz-Cf-Id') || undefined,
          bandwidthEstimate: this.hls?.bandwidthEstimate,
        });
      }
    });

    this.hls.loadSource(url);
    this.hls.attachMedia(videoElement);

    this.statsTimer = setInterval(() => {
      if (!this.video) return;
      const v = this.video as any;
      
      if (typeof v.getVideoPlaybackQuality === 'function') {
        const quality = v.getVideoPlaybackQuality();
        this.fireStats({
          kind: 'periodic',
          droppedFrames: quality.droppedVideoFrames,
          totalFrames: quality.totalVideoFrames,
          bandwidthEstimate: this.hls?.bandwidthEstimate,
        });
      } else if (typeof v.webkitDroppedFrameCount === 'number') {
        this.fireStats({
          kind: 'periodic',
          droppedFrames: v.webkitDroppedFrameCount,
          bandwidthEstimate: this.hls?.bandwidthEstimate,
        });
      }
    }, 10000);
  }

  destroy(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.video = null;
    this.levels = [];
  }

  getQualityLevels(): QualityLevel[] {
    return this.levels;
  }

  setQualityLevel(index: number): void {
    if (this.hls) {
      this.hls.currentLevel = index;
    }
  }

  getCurrentQuality(): number {
    return this.hls?.currentLevel ?? -1;
  }

  isAutoQuality(): boolean {
    return this.hls?.autoLevelEnabled ?? true;
  }

  setAutoQuality(): void {
    if (this.hls) {
      this.hls.currentLevel = -1;
    }
  }

  on(event: EngineEvent, callback: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: EngineEvent, callback: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private fire(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      cb(...args);
    }
  }

  private fireStats(stats: GallopEngineStats): void {
    this.fire('stats', { ...stats, statsSource: 'hlsjs' as const });
  }
}
