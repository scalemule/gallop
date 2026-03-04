# Gallop Web SDK - Implementation Plan v3

**Vanilla TypeScript Core + Web Component + React Wrapper**

*Updated February 2026 — aligned with core plan v3*

---

## Overview

This is the **web-specific** implementation plan for the Gallop Video Player SDK. It complements the [core implementation plan](../scalemule-gallop/IMPLEMENTATION_PLAN.md) with web-specific technical details.

### Architecture Summary

```
@scalemule/gallop (this package)
├── GallopPlayerCore        — Vanilla TypeScript class
├── <gallop-player>         — Web Component (Shadow DOM)
├── HLSJSEngine             — hls.js wrapper
├── NativeHLSEngine         — Safari/iOS native HLS
├── ThemeManager            — CSS custom properties
├── KeyboardManager         — YouTube-compatible shortcuts
└── PluginManager           — Extensible plugin system (Phase 3)

@scalemule/gallop-react (separate package)
└── <GallopPlayer />        — Thin React wrapper
```

---

## Package Configuration

### @scalemule/gallop

```json
{
  "name": "@scalemule/gallop",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./element": {
      "import": "./dist/element.js",
      "types": "./dist/element.d.ts"
    }
  },
  "files": ["dist"],
  "sideEffects": false,
  "peerDependencies": {},
  "dependencies": {
    "hls.js": "^1.5.0"
  }
}
```

### @scalemule/gallop-react

```json
{
  "name": "@scalemule/gallop-react",
  "version": "0.1.0",
  "peerDependencies": {
    "react": ">=18.0.0",
    "@scalemule/gallop": ">=0.1.0"
  }
}
```

---

## Build Configuration

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      element: 'src/element.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    target: 'es2020',
    external: [],
  },
  {
    // UMD bundle for <script> tag usage
    entry: { 'gallop.umd': 'src/umd.ts' },
    format: ['iife'],
    globalName: 'Gallop',
    minify: true,
    sourcemap: true,
  },
]);
```

### Usage Patterns

**Script tag (UMD):**

```html
<script src="https://cdn.scalemule.com/gallop/v1/gallop.umd.js"></script>
<gallop-player video-id="abc123" api-key="sm_sk_xxx"></gallop-player>
```

**npm + ESM:**

```typescript
import { GallopPlayerCore } from '@scalemule/gallop';

const player = new GallopPlayerCore({
  container: document.getElementById('player'),
  videoId: 'abc123',
  apiKey: 'sm_sk_xxx',
});
```

**npm + Web Component:**

```typescript
import '@scalemule/gallop/element';
// <gallop-player> is now registered as a custom element
```

**npm + React:**

```tsx
import { GallopPlayer } from '@scalemule/gallop-react';

<GallopPlayer videoId="abc123" apiKey="sm_sk_xxx" color="#4f46e5" />
```

---

## Core Implementation Details

### GallopPlayerCore

The core class has no framework dependencies. It accepts a container element and manages all playback, UI, and events.

```typescript
interface GallopConfig {
  // Required
  container: HTMLElement;

  // Video source (one of these)
  videoId?: string;        // ScaleMule video ID
  src?: string;            // Direct HLS URL

  // Authentication
  apiKey?: string;         // ScaleMule API key

  // Appearance
  color?: string;          // Shorthand for --gallop-color-primary
  poster?: string;         // Poster image URL
  fit?: 'contain' | 'cover' | 'fill';

  // Behavior
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  startTime?: number;      // Start at specific time (seconds)
  endBehavior?: 'default' | 'reset' | 'loop';
  resumable?: boolean;     // Resume from last position (localStorage)

  // Controls
  controls?: boolean;      // Show/hide all controls (default: true)
  hideSpeed?: boolean;
  hideQuality?: boolean;
  hideFullscreen?: boolean;
  hidePip?: boolean;

  // Branding
  logoSrc?: string;
  logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  logoLink?: string;

  // Advanced
  keyboard?: boolean | KeyboardConfig;
  plugins?: GallopPlugin[];
  debug?: boolean;

  // Engine
  hlsConfig?: Partial<HlsConfig>;  // Override hls.js config
}
```

### Web Component

```typescript
class GallopPlayerElement extends HTMLElement {
  static observedAttributes = [
    'video-id', 'api-key', 'src', 'color', 'poster', 'fit',
    'autoplay', 'muted', 'loop', 'preload', 'start-time',
    'end-behavior', 'resumable', 'controls',
    'hide-speed', 'hide-quality', 'hide-fullscreen', 'hide-pip',
    'logo-src', 'logo-position', 'logo-link',
    'disable-keyboard', 'debug', 'do-not-track',
  ];

  private core: GallopPlayerCore | null = null;
  private shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const container = document.createElement('div');
    container.className = 'gallop-root';
    this.shadow.appendChild(container);

    this.core = new GallopPlayerCore({
      container,
      ...this.getConfigFromAttributes(),
    });
  }

  disconnectedCallback() {
    this.core?.destroy();
    this.core = null;
  }

  attributeChangedCallback(name: string, _old: string, value: string) {
    if (name === 'color' && value) {
      this.style.setProperty('--gallop-color-primary', value);
    }
    // Forward attribute changes to core
    this.core?.updateConfig({ [this.attrToConfig(name)]: value });
  }
}

customElements.define('gallop-player', GallopPlayerElement);
```

### React Wrapper

```tsx
import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { GallopPlayerCore, GallopConfig } from '@scalemule/gallop';

interface GallopPlayerProps extends Omit<GallopConfig, 'container'> {
  className?: string;
  style?: React.CSSProperties;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onError?: (error: Error) => void;
}

export const GallopPlayer = forwardRef<GallopPlayerCore, GallopPlayerProps>(
  ({ className, style, onPlay, onPause, onEnded, onTimeUpdate, onError, ...config }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<GallopPlayerCore | null>(null);

    useImperativeHandle(ref, () => playerRef.current!, []);

    useEffect(() => {
      if (!containerRef.current) return;

      // Dynamic import to avoid SSR issues
      import('@scalemule/gallop').then(({ GallopPlayerCore }) => {
        const player = new GallopPlayerCore({
          container: containerRef.current!,
          ...config,
        });

        if (onPlay) player.on('play', onPlay);
        if (onPause) player.on('pause', onPause);
        if (onEnded) player.on('ended', onEnded);
        if (onTimeUpdate) player.on('timeupdate', onTimeUpdate);
        if (onError) player.on('error', onError);

        playerRef.current = player;
      });

      return () => {
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    }, [config.videoId, config.src]);

    return <div ref={containerRef} className={className} style={style} />;
  }
);
```

---

## Engine Architecture

### StreamingEngine Interface

```typescript
interface StreamingEngine {
  load(url: string, videoElement: HTMLVideoElement): Promise<void>;
  destroy(): void;

  getQualityLevels(): QualityLevel[];
  setQuality(index: number | 'auto'): void;
  getCurrentQuality(): number;

  on(event: 'ready', handler: () => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'qualityChange', handler: (level: number) => void): void;
  on(event: 'bufferChange', handler: (seconds: number) => void): void;
}

interface QualityLevel {
  index: number;
  width: number;
  height: number;
  bitrate: number;
  label: string;  // "720p", "1080p", etc.
}
```

### Engine Selection

```typescript
function createEngine(config: GallopConfig): StreamingEngine {
  // iOS Safari: no MSE support
  if (isIOSSafari() || !('MediaSource' in window)) {
    return new NativeHLSEngine();
  }

  // Safari desktop: native HLS is fine, but MSE also works
  // Use hls.js for consistency (quality selector, ABR tuning)
  if (Hls.isSupported()) {
    return new HLSJSEngine(config.hlsConfig);
  }

  // Fallback: native HLS
  if (canPlayHLS()) {
    return new NativeHLSEngine();
  }

  throw new Error('No supported streaming engine found');
}
```

---

## Testing Strategy

### Unit Tests (Vitest)

```
tests/unit/
├── core/
│   ├── GallopPlayerCore.test.ts
│   ├── EventEmitter.test.ts
│   └── StateMachine.test.ts
├── engine/
│   ├── HLSJSEngine.test.ts
│   └── NativeHLSEngine.test.ts
├── ui/
│   ├── Controls.test.ts
│   ├── ProgressBar.test.ts
│   ├── QualityMenu.test.ts
│   └── SpeedMenu.test.ts
├── input/
│   ├── KeyboardManager.test.ts
│   └── TouchGestureManager.test.ts
├── theme/
│   └── ThemeManager.test.ts
└── api/
    └── ScaleMuleClient.test.ts
```

### E2E Tests (Playwright)

```
tests/e2e/
├── playback.spec.ts           # Play, pause, seek, end
├── controls.spec.ts           # All UI controls
├── keyboard.spec.ts           # All keyboard shortcuts
├── quality-switching.spec.ts  # Quality selector, ABR
├── theming.spec.ts            # CSS custom properties
├── web-component.spec.ts      # Attribute reflection
├── react-wrapper.spec.ts      # React integration
├── mobile.spec.ts             # Touch gestures
├── accessibility.spec.ts      # ARIA, focus, screen reader
└── ios-native.spec.ts         # iOS Safari fallback
```

---

## Browser Support

| Browser | Version | Engine | Notes |
|---------|---------|--------|-------|
| Chrome | 70+ | HLSJSEngine | Full feature support |
| Firefox | 78+ | HLSJSEngine | Full feature support |
| Safari | 14+ | HLSJSEngine or NativeHLSEngine | MSE supported since Safari 8 |
| Edge | 79+ | HLSJSEngine | Chromium-based |
| iOS Safari | 14+ | NativeHLSEngine | No MSE, native HLS only |
| Android Chrome | 70+ | HLSJSEngine | Full feature support |

---

## Phase Schedule (Web-Specific)

| Phase | Weeks | Deliverable |
|-------|-------|-------------|
| 1A | 1-5 | GallopPlayerCore, HLSJSEngine, Controls, Web Component, React wrapper |
| 1B | 6-7 | Theming, branding, resumable playback, mobile UX |
| 1C | 8-10 | Thumbnails, chapters, PiP, lazy loading |
| 2 | 11-13 | Analytics engine, heatmaps, performance metrics |
| 3 | 14-15 | Plugin system, iframe embed |

See the [core implementation plan](../scalemule-gallop/IMPLEMENTATION_PLAN.md) for detailed weekly breakdowns.
