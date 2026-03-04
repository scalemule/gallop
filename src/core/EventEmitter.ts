import type { GallopEventMap, GallopEventCallback } from '../types';

type Listener = (...args: unknown[]) => void;

export class EventEmitter {
  private listeners = new Map<string, Set<Listener>>();

  on<K extends keyof GallopEventMap>(
    event: K,
    callback: GallopEventCallback<GallopEventMap[K]>,
  ): void {
    if (!this.listeners.has(event as string)) {
      this.listeners.set(event as string, new Set());
    }
    this.listeners.get(event as string)!.add(callback as Listener);
  }

  off<K extends keyof GallopEventMap>(
    event: K,
    callback: GallopEventCallback<GallopEventMap[K]>,
  ): void {
    this.listeners.get(event as string)?.delete(callback as Listener);
  }

  once<K extends keyof GallopEventMap>(
    event: K,
    callback: GallopEventCallback<GallopEventMap[K]>,
  ): void {
    const wrapper = ((...args: unknown[]) => {
      this.off(event, wrapper as GallopEventCallback<GallopEventMap[K]>);
      (callback as Listener)(...args);
    }) as GallopEventCallback<GallopEventMap[K]>;
    this.on(event, wrapper);
  }

  protected emit<K extends keyof GallopEventMap>(
    event: K,
    ...args: GallopEventMap[K] extends void ? [] : [GallopEventMap[K]]
  ): void {
    const set = this.listeners.get(event as string);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(...args);
      } catch (err) {
        console.error(`[Gallop] Error in ${event as string} listener:`, err);
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
