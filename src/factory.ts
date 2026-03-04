import { GallopPlayer, GallopConfig } from './types';
import { GallopPlayerCore } from './core/GallopPlayerCore';
import { GallopIframeController } from './iframe/GallopIframeController';
import { GallopPlayerProxy } from './core/GallopPlayerProxy';
import { GALLOP_VERSION } from './version';

export const Gallop = {
  /**
   * Creates an inline player instance.
   */
  createInline(container: HTMLElement, config: GallopConfig): GallopPlayer {
    return new GallopPlayerCore(container, config);
  },

  /**
   * Creates an iframe-based player instance.
   */
  createIframe(container: HTMLElement, config: GallopConfig): GallopPlayer {
    return new GallopIframeController(container, config);
  },

  /**
   * Unified factory for Gallop Player.
   * Supports 'inline', 'iframe', and 'auto' modes.
   */
  create(container: HTMLElement, config: GallopConfig): GallopPlayer {
    const mode = config.mode || 'inline';

    switch (mode) {
      case 'iframe':
        return this.createIframe(container, config);
      case 'inline':
        return this.createInline(container, config);
      case 'auto':
        return new GallopPlayerProxy(container, config);
      default:
        console.warn(`[Gallop] Unknown mode: ${mode}, falling back to inline`);
        return this.createInline(container, config);
    }
  },

  version: GALLOP_VERSION
};
