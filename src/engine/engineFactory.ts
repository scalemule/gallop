import Hls from 'hls.js';
import type { IStreamingEngine, EngineAuthOptions } from './StreamingEngine';
import { HLSJSEngine } from './HLSJSEngine';
import { NativeHLSEngine } from './NativeHLSEngine';
import { NativeFileEngine } from './NativeFileEngine';
import { supportsNativeHLS } from '../utils/device';

export type { EngineAuthOptions } from './StreamingEngine';

/**
 * Return `true` if the URL / MIME indicates an HLS manifest (`.m3u8` or
 * `application/vnd.apple.mpegurl`). Handles query strings on presigned URLs.
 */
export function isHlsSource(url?: string, mimeType?: string): boolean {
  if (mimeType === 'application/vnd.apple.mpegurl' || mimeType === 'application/x-mpegurl') {
    return true;
  }
  if (!url) return false;
  const pathOnly = url.split('?')[0].split('#')[0].toLowerCase();
  return pathOnly.endsWith('.m3u8');
}

/**
 * Pick the streaming engine for a given source.
 *
 * HLS manifests route through hls.js (or Safari's native HLS where hls.js
 * isn't supported). Progressive-download formats (mp4, webm, mov, ogg) go
 * through `NativeFileEngine` which just assigns `video.src` — Gallop's
 * controls still render, but the streaming layer is a no-op.
 *
 * `url` / `mimeType` are optional for back-compat with existing callers that
 * invoke `createEngine()` before they have a source. When both are omitted
 * we default to the HLS path (the pre-0.0.4 behaviour).
 */
export function createEngine(
  auth?: string | EngineAuthOptions,
  hlsConfig?: Record<string, unknown>,
  url?: string,
  mimeType?: string,
): IStreamingEngine {
  const authOpts: EngineAuthOptions = typeof auth === 'string' ? { apiKey: auth } : (auth ?? {});

  // Explicit non-HLS source → progressive-download engine.
  if (url && !isHlsSource(url, mimeType)) {
    return new NativeFileEngine();
  }

  if (Hls.isSupported()) {
    return new HLSJSEngine(authOpts, hlsConfig);
  }
  if (supportsNativeHLS()) {
    return new NativeHLSEngine();
  }
  throw new Error('HLS playback is not supported in this browser');
}
