import type { ScaleMuleClient } from '../api/ScaleMuleClient';
import type { GallopAnalyticsConfig, GallopEngineStats, PlaybackEventType, QualityLevel, TrackPlaybackPayload } from '../types';
import type { GallopPlayerCore } from '../core/GallopPlayerCore';

interface CollectorOptions {
  client: ScaleMuleClient;
  player: GallopPlayerCore;
  videoId: string;
  config?: GallopAnalyticsConfig;
}

interface NetworkInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

type NetworkNavigator = Navigator & {
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
};

const DEFAULTS = {
  flushIntervalMs: 3000,
  maxBatchSize: 20,
  maxQueueSize: 300,
  progressIntervalSeconds: 10,
};

export class AnalyticsCollector {
  private readonly client: ScaleMuleClient;
  private readonly player: GallopPlayerCore;
  private readonly config: GallopAnalyticsConfig;
  private videoId: string;
  private readonly sessionId: string;

  private queue: TrackPlaybackPayload[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private destroyed = false;

  private playRequestedAtMs: number | null = null;
  private ttffMs: number | null = null;
  private firstFrameSeen = false;
  private lastProgressPosition = 0;
  private maxPositionSeen = 0;
  private watchedSeconds = 0;
  private lastHeartbeatPosition = 0;

  private bufferStartedAtMs: number | null = null;
  private totalBufferMs = 0;

  private startupQuality: string | null = null;
  private qualitySwitches = 0;
  private lastQuality: string | null = null;

  private lastEngineStats: GallopEngineStats | null = null;
  private cdnNode: string | null = null;
  private cdnCacheStatus: string | null = null;
  private cdnRequestID: string | null = null;
  private initialDroppedFrames: number | null = null;
  private droppedFrames = 0;

  private isVisible = true;
  private observer: IntersectionObserver | null = null;

  private readonly onPlay = () => this.handlePlay();
  private readonly onPause = () => this.handlePause();
  private readonly onEnded = () => this.handleEnded();
  private readonly onSeeked = ({ time }: { time: number }) => this.handleSeeked(time);
  private readonly onTimeUpdate = ({ currentTime }: { currentTime: number; duration: number }) => this.handleTimeUpdate(currentTime);
  private readonly onBuffering = ({ isBuffering }: { isBuffering: boolean }) => this.handleBuffering(isBuffering);
  private readonly onQualityChange = ({ level }: { level: QualityLevel }) => this.handleQualityChange(level);
  private readonly onError = ({ code, message }: { code: string; message: string }) => this.handleError(code, message);
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.enqueue('pause', this.player.currentTime, { event_subtype: 'document_hidden' }, true);
      void this.flush(true);
    }
  };
  private readonly onPageHide = () => {
    this.enqueue('pause', this.player.currentTime, { event_subtype: 'pagehide' }, true);
    void this.flush(true);
  };

  constructor(options: CollectorOptions) {
    this.client = options.client;
    this.player = options.player;
    this.videoId = options.videoId;
    this.config = options.config ?? {};
    this.sessionId = this.config.sessionId ?? createSessionId();

    this.bind();
    this.start();
    this.initVisibilityTracking();
  }

  setVideoId(videoId: string): void {
    this.videoId = videoId;
  }

  onEngineStats(stats: GallopEngineStats): void {
    this.lastEngineStats = stats;

    if (stats.cdnNode) this.cdnNode = stats.cdnNode;
    if (stats.cdnCacheStatus) this.cdnCacheStatus = stats.cdnCacheStatus;
    if (stats.cdnRequestID) this.cdnRequestID = stats.cdnRequestID;

    if (stats.kind === 'periodic' && stats.droppedFrames !== undefined) {
      if (this.initialDroppedFrames === null) {
        this.initialDroppedFrames = stats.droppedFrames;
      } else {
        this.droppedFrames = stats.droppedFrames - this.initialDroppedFrames;
      }
    }
  }

  trackEvent(
    eventType: PlaybackEventType,
    timestampSeconds: number,
    metadata: Record<string, unknown> = {},
    urgent = false,
  ): void {
    this.enqueue(eventType, timestampSeconds, metadata, urgent);
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.unbind();

    if (this.bufferStartedAtMs !== null) {
      const durationMs = Date.now() - this.bufferStartedAtMs;
      this.totalBufferMs += Math.max(0, durationMs);
      this.bufferStartedAtMs = null;
    }

    this.enqueue('pause', this.player.currentTime, { event_subtype: 'destroy' }, true);
    await this.flush(true);

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.destroyed = true;
  }

  private bind(): void {
    this.player.on('play', this.onPlay);
    this.player.on('pause', this.onPause);
    this.player.on('ended', this.onEnded);
    this.player.on('seeked', this.onSeeked);
    this.player.on('timeupdate', this.onTimeUpdate);
    this.player.on('buffering', this.onBuffering);
    this.player.on('qualitychange', this.onQualityChange);
    this.player.on('error', this.onError);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.onPageHide);
    }
  }

  private unbind(): void {
    this.player.off('play', this.onPlay);
    this.player.off('pause', this.onPause);
    this.player.off('ended', this.onEnded);
    this.player.off('seeked', this.onSeeked);
    this.player.off('timeupdate', this.onTimeUpdate);
    this.player.off('buffering', this.onBuffering);
    this.player.off('qualitychange', this.onQualityChange);
    this.player.off('error', this.onError);

    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHide);
    }
  }

  private start(): void {
    this.flushTimer = setInterval(() => {
      void this.flush(false);
    }, this.config.flushIntervalMs ?? DEFAULTS.flushIntervalMs);
  }

  private handlePlay(): void {
    this.playRequestedAtMs = Date.now();
    this.enqueue('play', this.player.currentTime);
  }

  private handlePause(): void {
    this.enqueue('pause', this.player.currentTime);
    void this.flush(false);
  }

  private handleEnded(): void {
    this.enqueue('complete', this.player.currentTime, {
      completion_ratio: safeRatio(this.player.currentTime, this.player.duration),
    }, true);
    void this.flush(false);
  }

  private handleSeeked(time: number): void {
    this.lastProgressPosition = time;
    this.maxPositionSeen = Math.max(this.maxPositionSeen, time);
    this.enqueue('seek', time);
  }

  private handleTimeUpdate(currentTime: number): void {
    if (!Number.isFinite(currentTime)) {
      return;
    }

    if (!this.firstFrameSeen && this.playRequestedAtMs !== null) {
      this.firstFrameSeen = true;
      this.ttffMs = Math.max(0, Date.now() - this.playRequestedAtMs);
    }

    if (this.lastProgressPosition > 0) {
      const delta = currentTime - this.lastProgressPosition;
      if (delta > 0 && delta < 5) {
        this.watchedSeconds += delta;
      }
    }

    this.lastProgressPosition = currentTime;
    this.maxPositionSeen = Math.max(this.maxPositionSeen, currentTime);

    const progressInterval = this.config.progressIntervalSeconds ?? DEFAULTS.progressIntervalSeconds;
    if (Math.abs(currentTime - this.lastHeartbeatPosition) >= progressInterval) {
      this.lastHeartbeatPosition = currentTime;
      this.enqueue('play', currentTime, { event_subtype: 'heartbeat' });
    }
  }

  private initVisibilityTracking(): void {
    if (this.config.trackVisibility === false || typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const wasVisible = this.isVisible;
        this.isVisible = entry.isIntersecting;

        if (wasVisible !== this.isVisible) {
          this.enqueue('play', this.player.currentTime, {
            event_subtype: 'visibility_change',
            is_visible: this.isVisible,
            intersection_ratio: round(entry.intersectionRatio, 3),
          });
        }
      }
    }, { threshold: [0, 0.25, 0.5, 0.75, 1.0] });

    const el = this.player.getWrapperElement();
    if (el) {
      this.observer.observe(el);
    }
  }

  private handleBuffering(isBuffering: boolean): void {
    if (isBuffering) {
      if (this.bufferStartedAtMs !== null) return;
      this.bufferStartedAtMs = Date.now();
      this.enqueue('buffer', this.player.currentTime, { buffering_state: 'start' });
      return;
    }

    if (this.bufferStartedAtMs === null) return;

    const durationMs = Math.max(0, Date.now() - this.bufferStartedAtMs);
    this.totalBufferMs += durationMs;
    this.bufferStartedAtMs = null;

    this.enqueue('buffer', this.player.currentTime, {
      buffering_state: 'end',
      buffering_duration_ms: Math.round(durationMs),
    });
  }

  private handleQualityChange(level: QualityLevel): void {
    const label = level.label || `${level.height}p`;
    if (!this.startupQuality) {
      this.startupQuality = label;
    }

    if (this.lastQuality && this.lastQuality !== label) {
      this.qualitySwitches += 1;
    }
    this.lastQuality = label;

    this.enqueue('play', this.player.currentTime, {
      event_subtype: 'quality_change',
      quality_label: label,
      quality_bitrate: level.bitrate,
      quality_height: level.height,
      quality_width: level.width,
    });
  }

  private handleError(code: string, message: string): void {
    this.enqueue('error', this.player.currentTime, {
      error_code: code,
      error_message: message,
      error_classification: classifyError(code, this.lastEngineStats),
    }, true);
    void this.flush(false);
  }

  private enqueue(
    eventType: PlaybackEventType,
    timestampSeconds: number,
    metadata: Record<string, unknown> = {},
    urgent = false,
  ): void {
    if (!this.videoId) {
      return;
    }

    const quality = this.resolveQuality();
    const payload: TrackPlaybackPayload = {
      session_id: this.sessionId,
      event_type: eventType,
      timestamp_seconds: Number.isFinite(timestampSeconds) ? round(timestampSeconds, 3) : undefined,
      quality: quality ?? undefined,
      metadata: this.buildMetadata(metadata),
    };

    this.queue.push(payload);

    const maxQueue = this.config.maxQueueSize ?? DEFAULTS.maxQueueSize;
    if (this.queue.length > maxQueue) {
      this.queue.splice(0, this.queue.length - maxQueue);
    }

    if (this.config.debug) {
      console.debug('[Gallop analytics] queued event', payload);
    }

    if (urgent) {
      void this.flush(false);
    }
  }

  private async flush(keepalive: boolean): Promise<void> {
    if (this.flushing || this.queue.length === 0) {
      return;
    }

    this.flushing = true;
    const maxBatchSize = this.config.maxBatchSize ?? DEFAULTS.maxBatchSize;

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, maxBatchSize);
        for (let i = 0; i < batch.length; i++) {
          try {
            await this.client.trackPlayback(this.videoId, batch[i], { keepalive });
          } catch (err) {
            if (this.config.debug) {
              console.warn('[Gallop analytics] failed to send event', { event: batch[i], err });
            }
            this.queue.unshift(...batch.slice(i));
            return;
          }
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  private buildMetadata(overrides: Record<string, unknown>): Record<string, unknown> {
    const watchSeconds = round(this.watchedSeconds, 3);
    const currentTime = round(this.player.currentTime, 3);
    const duration = round(this.player.duration, 3);
    const rebufferRatio = safeRatio(this.totalBufferMs / 1000, this.watchedSeconds);

    const buffered = this.player.buffered;
    let bufferDepth = 0;
    for (let i = 0; i < buffered.length; i++) {
      if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
        bufferDepth = buffered.end(i) - currentTime;
        break;
      }
    }

    const metadata: Record<string, unknown> = {
      ...(this.config.metadata ?? {}),
      ...overrides,
      current_time_seconds: currentTime,
      duration_seconds: duration,
      watched_seconds: watchSeconds,
      max_position_seconds: round(this.maxPositionSeen, 3),
      watch_through_ratio: safeRatio(this.maxPositionSeen, this.player.duration),
      completion_ratio: safeRatio(this.player.currentTime, this.player.duration),
      ttff_ms: this.ttffMs,
      total_buffer_ms: Math.round(this.totalBufferMs),
      rebuffer_ratio: rebufferRatio,
      buffer_depth_seconds: round(bufferDepth, 3),
      quality_switches: this.qualitySwitches,
      startup_quality: this.startupQuality,
      dropped_frames: this.droppedFrames,
      is_visible: this.isVisible,
      cdn_node: this.cdnNode,
      cdn_cache_status: this.cdnCacheStatus,
      cdn_request_id: this.cdnRequestID,
      playback_rate: this.player.playbackRate,
      muted: this.player.muted,
      volume: round(this.player.volume, 3),
      status: this.player.status,
      viewport_width: typeof window !== 'undefined' ? window.innerWidth : undefined,
      viewport_height: typeof window !== 'undefined' ? window.innerHeight : undefined,
      device_pixel_ratio: typeof window !== 'undefined' ? window.devicePixelRatio : undefined,
      hls_bandwidth_estimate_bps: this.lastEngineStats?.bandwidthEstimate,
      hls_stats_kind: this.lastEngineStats?.kind,
      hls_level: this.lastEngineStats?.level,
      hls_fragment_duration: this.lastEngineStats?.fragmentDuration,
      hls_fragment_size_bytes: this.lastEngineStats?.fragmentSizeBytes,
      hls_fragment_load_ms: this.lastEngineStats?.fragmentLoadMs,
      hls_error_type: this.lastEngineStats?.errorType,
      hls_error_details: this.lastEngineStats?.errorDetails,
      hls_error_fatal: this.lastEngineStats?.fatal,
      stats_source: this.lastEngineStats?.statsSource,
      tao_available: this.lastEngineStats?.taoAvailable,
    };

    if (this.config.includeNetworkInfo ?? true) {
      const networkInfo = getNetworkInfo();
      metadata.connection_effective_type = networkInfo.effectiveType;
      metadata.connection_downlink_mbps = networkInfo.downlink;
      metadata.connection_rtt_ms = networkInfo.rtt;
      metadata.connection_save_data = networkInfo.saveData;
    }

    if (this.config.includeDeviceInfo ?? true) {
      metadata.user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
      metadata.language = typeof navigator !== 'undefined' ? navigator.language : undefined;
      metadata.platform = typeof navigator !== 'undefined' ? navigator.platform : undefined;
      metadata.device_memory_gb = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined;
      metadata.hardware_concurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
      metadata.screen_width = typeof screen !== 'undefined' ? screen.width : undefined;
      metadata.screen_height = typeof screen !== 'undefined' ? screen.height : undefined;
    }

    return removeUndefined(metadata);
  }

  private resolveQuality(): string | null {
    const active = this.player.getQualityLevels().find((level) => level.active);
    if (active) {
      return active.label || `${active.height}p`;
    }

    if (this.lastQuality) {
      return this.lastQuality;
    }

    const currentIndex = this.player.getCurrentQuality();
    if (currentIndex >= 0) {
      return `level_${currentIndex}`;
    }

    return null;
  }
}

function getNetworkInfo(): NetworkInfo {
  if (typeof navigator === 'undefined') {
    return {};
  }

  const connection = (navigator as NetworkNavigator).connection;
  if (!connection) {
    return {};
  }

  return {
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    rtt: connection.rtt,
    saveData: connection.saveData,
  };
}

function classifyError(code: string, stats: GallopEngineStats | null): string {
  const lowered = code.toLowerCase();
  if (lowered.includes('network') || stats?.errorType?.toLowerCase().includes('network')) {
    return 'network';
  }
  if (lowered.includes('media') || stats?.errorType?.toLowerCase().includes('media')) {
    return 'media';
  }
  return 'unknown';
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function round(value: number, digits: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return round(numerator / denominator, 4);
}

function removeUndefined(metadata: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
}
