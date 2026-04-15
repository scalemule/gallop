import type { QualityLevel } from '../types';
import type { EngineEvent, IStreamingEngine } from './StreamingEngine';

/**
 * Engine for progressive-download sources the browser can play directly
 * (mp4, webm, mov, ogg). HLS.js can't parse these — this engine just
 * assigns `video.src` and lets the element drive playback natively.
 *
 * Chat attachments are the primary use case: customers upload raw mp4s
 * to object storage with no transcoding, so the Gallop chrome still
 * renders but the streaming engine is a no-op.
 *
 * Quality-level controls are absent (there's only one source); the
 * interface surface mirrors `NativeHLSEngine` so the player core doesn't
 * need to branch on engine kind.
 */
export class NativeFileEngine implements IStreamingEngine {
  private video: HTMLVideoElement | null = null;
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  load(url: string, videoElement: HTMLVideoElement): void {
    this.destroy();
    this.video = videoElement;

    videoElement.src = url;

    videoElement.addEventListener('loadedmetadata', () => {
      // Fire an empty qualitylevels so the UI knows the engine loaded and
      // drops any pending "loading quality" state.
      this.fire('qualitylevels', []);
    });

    videoElement.addEventListener('error', () => {
      const err = videoElement.error;
      this.fire('error', {
        code: `MEDIA_ERR_${err?.code ?? 0}`,
        message: err?.message ?? 'Native file playback error',
      });
    });
  }

  destroy(): void {
    if (this.video) {
      this.video.removeAttribute('src');
      this.video.load();
      this.video = null;
    }
  }

  getQualityLevels(): QualityLevel[] {
    return [];
  }

  setQualityLevel(_index: number): void {
    /* single quality — no-op */
  }

  getCurrentQuality(): number {
    return -1;
  }

  isAutoQuality(): boolean {
    return true;
  }

  setAutoQuality(): void {
    /* no-op */
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
