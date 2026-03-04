import { GallopPlayerCore } from '../core/GallopPlayerCore';
import { PostMessageBridge } from './PostMessageBridge';
import { GallopConfig } from '../types';
import { GALLOP_VERSION } from '../version';

/** Config keys allowed from hash fragment (advisory only, no auth/security fields). */
const ALLOWED_CONFIG_KEYS = new Set<string>([
  'autoplay', 'muted', 'loop', 'controls', 'startTime',
  'preferredQuality', 'aspectRatio', 'theme', 'debug',
  'doNotTrack', 'analytics', 'pageUrl',
]);

const MAX_HASH_CONFIG_BYTES = 4096;

function parseHashConfig(hash: string): { config: Partial<GallopConfig>; error?: string } {
  if (!hash.startsWith('config=')) {
    return { config: {} };
  }

  const encoded = hash.slice(7);

  // Size check before decode
  if (encoded.length > MAX_HASH_CONFIG_BYTES) {
    return { config: {}, error: 'CONFIG_TOO_LARGE' };
  }

  let json: string;
  try {
    json = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return { config: {}, error: 'CONFIG_PARSE_ERROR' };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { config: {}, error: 'CONFIG_PARSE_ERROR' };
    }
  } catch {
    return { config: {}, error: 'CONFIG_PARSE_ERROR' };
  }

  // Whitelist: strip unknown keys
  const safe: Record<string, unknown> = {};
  for (const key of Object.keys(parsed)) {
    if (ALLOWED_CONFIG_KEYS.has(key)) {
      safe[key] = parsed[key];
    }
  }

  return { config: safe as Partial<GallopConfig> };
}

/**
 * Bootstraps the Gallop Player inside an iframe embed shell.
 * Reads videoId from URL path, token from query, config from hash.
 */
export function bootstrapEmbed() {
  let bridge: PostMessageBridge | null = null;

  try {
    const url = new URL(window.location.href);

    // 1. Extract videoId from path: /embed/{videoId}
    const pathParts = url.pathname.split('/');
    const videoId = pathParts[pathParts.length - 1];

    // 2. Extract token from query: ?token=...
    const embedToken = url.searchParams.get('token') || undefined;

    // 3. Extract config from hash: #config=<base64url_json>
    const hash = window.location.hash.slice(1);
    const { config: hashConfig, error: configError } = parseHashConfig(hash);

    // 4. Merge configs — videoId and embedToken from URL override hash
    const config: GallopConfig = {
      ...hashConfig,
      videoId,
      embedToken,
    };

    // 5. Initialize player
    const container = document.getElementById('player-container') || document.body;
    const player = new GallopPlayerCore(container, config);

    // 6. Bridge to host
    bridge = new PostMessageBridge(player);

    // 7. Emit config parse error if applicable (after bridge is up so host receives it)
    if (configError) {
      player.on('ready', () => {
        // Delay error emission so the host can attach listeners first
        setTimeout(() => {
          (player as any).emit?.('error', { code: configError, message: `Hash config error: ${configError}` });
        }, 0);
      });
    }

    console.log('[Gallop] Embed initialized', { videoId, version: GALLOP_VERSION });
  } catch (err) {
    console.error('[Gallop] Critical embed failure', err);
    // Try to notify host of failure
    try {
      window.parent.postMessage({
        type: 'gallop:error',
        code: 'EMBED_LOAD_FAILED',
        message: err instanceof Error ? err.message : 'Critical embed failure',
        version: 1,
      }, '*');
    } catch {
      // Cannot communicate with host
    }
  }
}

// NOTE: Auto-execution removed. The embed bundle entry (embed/index.ts) handles
// auto-bootstrap. This module is a pure export so the UMD bundle can import
// bootstrapEmbed without triggering side effects on non-embed pages.
