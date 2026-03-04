import Hls from 'hls.js';
import type { IStreamingEngine, EngineAuthOptions } from './StreamingEngine';
import { HLSJSEngine } from './HLSJSEngine';
import { NativeHLSEngine } from './NativeHLSEngine';
import { supportsNativeHLS } from '../utils/device';

export type { EngineAuthOptions } from './StreamingEngine';

export function createEngine(auth?: string | EngineAuthOptions, hlsConfig?: Record<string, unknown>): IStreamingEngine {
  const authOpts: EngineAuthOptions = typeof auth === 'string' ? { apiKey: auth } : (auth ?? {});
  if (Hls.isSupported()) {
    return new HLSJSEngine(authOpts, hlsConfig);
  }
  if (supportsNativeHLS()) {
    return new NativeHLSEngine();
  }
  throw new Error('HLS playback is not supported in this browser');
}
