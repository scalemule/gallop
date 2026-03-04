import type { QualityLevel } from '../types';
import type { EngineEvent, IStreamingEngine } from './StreamingEngine';

export class NativeHLSEngine implements IStreamingEngine {
  private video: HTMLVideoElement | null = null;
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private lastResourceIndex = 0;
  private sourceHost: string | null = null;

  load(url: string, videoElement: HTMLVideoElement): void {
    this.destroy();
    this.video = videoElement;

    try {
      const parsed = new URL(url, window.location.href);
      this.sourceHost = parsed.host;
    } catch {
      this.sourceHost = null;
    }

    videoElement.src = url;
    videoElement.addEventListener('loadedmetadata', () => {
      this.fire('qualitylevels', []);
    });
    videoElement.addEventListener('error', () => {
      const err = videoElement.error;
      this.fire('error', {
        code: `MEDIA_ERR_${err?.code ?? 0}`,
        message: err?.message ?? 'Native playback error',
      });
    });

    this.statsTimer = setInterval(() => {
      this.scavengeStats();
    }, 10000);
  }

  destroy(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    if (this.video) {
      this.video.removeAttribute('src');
      this.video.load();
      this.video = null;
    }
  }

  private scavengeStats(): void {
    if (!this.video) return;

    // 1. Frame drops (using webkit prefix for Safari support)
    const v = this.video as any;
    let droppedFrames: number | undefined;
    let totalFrames: number | undefined;

    if (typeof v.getVideoPlaybackQuality === 'function') {
      const q = v.getVideoPlaybackQuality();
      droppedFrames = q.droppedVideoFrames;
      totalFrames = q.totalVideoFrames;
    } else if (typeof v.webkitDroppedFrameCount === 'number') {
      droppedFrames = v.webkitDroppedFrameCount;
      // Total frames isn't directly exposed with webkit prefix, 
      // but we can at least send the drop count.
    }

    // 2. Resource scavenging (fragments) — filtered by video source host
    if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      for (let i = this.lastResourceIndex; i < resources.length; i++) {
        const res = resources[i];
        if (!this.isVideoFragment(res.name)) continue;

        // TAO detection: cross-origin resources without Timing-Allow-Origin report 0 for transferSize
        const isCrossOrigin = this.sourceHost !== null && !res.name.includes(window.location.host);
        const taoAvailable = !isCrossOrigin || res.transferSize > 0 || res.responseStart > 0;

        this.fire('stats', {
          kind: 'fragment',
          statsSource: 'native_resource_timing',
          fragmentLoadMs: Math.round(res.duration),
          fragmentSizeBytes: taoAvailable && res.transferSize > 0 ? res.transferSize : undefined,
          bandwidthEstimate: taoAvailable && res.transferSize > 0 && res.duration > 0
            ? Math.round((res.transferSize * 8) / (res.duration / 1000))
            : undefined,
          taoAvailable,
        });
      }
      this.lastResourceIndex = resources.length;
    }

    this.fire('stats', {
      kind: 'periodic',
      statsSource: 'native_resource_timing',
      droppedFrames,
      totalFrames,
    });
  }

  private isVideoFragment(url: string): boolean {
    // Must be from the same host as the video source
    if (this.sourceHost) {
      try {
        const parsed = new URL(url, window.location.href);
        if (parsed.host !== this.sourceHost) return false;
      } catch {
        return false;
      }
    }

    // Match HLS segment patterns by path (not query string)
    const path = url.split('?')[0];
    return path.endsWith('.ts') || path.endsWith('.m4s') || path.endsWith('.m4v')
      || path.includes('/seg-') || path.includes('/segment');
  }

  getQualityLevels(): QualityLevel[] {
    return [];
  }

  setQualityLevel(_index: number): void {
    // Native HLS does not expose quality level control
  }

  getCurrentQuality(): number {
    return -1;
  }

  isAutoQuality(): boolean {
    return true;
  }

  setAutoQuality(): void {
    // Always auto in native HLS
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
}
