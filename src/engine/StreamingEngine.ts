import type { GallopEngineStats, QualityLevel } from '../types';

export type EngineEvent = 'qualitylevels' | 'qualitychange' | 'error' | 'buffering' | 'stats';

export interface IStreamingEngine {
  load(url: string, videoElement: HTMLVideoElement): void;
  destroy(): void;
  getQualityLevels(): QualityLevel[];
  setQualityLevel(index: number): void;
  getCurrentQuality(): number;
  isAutoQuality(): boolean;
  setAutoQuality(): void;
  on(event: EngineEvent, callback: (...args: unknown[]) => void): void;
  off(event: EngineEvent, callback: (...args: unknown[]) => void): void;
}

export type EngineStats = GallopEngineStats;

export interface EngineAuthOptions {
  apiKey?: string;
  embedToken?: string;
}
