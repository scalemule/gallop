# Gallop Web SDK

**ScaleMule's Video Player for Web Applications**

*TypeScript • MSE • Zero Dependencies*

---

## Overview

The Gallop Web SDK is a high-performance video player built with TypeScript and native browser APIs. It provides ScaleMule customers with a premium streaming experience including social features, deep analytics, and optimized playback.

### Key Features

- **Instant Start** - Pre-warming system for TikTok-like instant playback
- **50% Bandwidth Savings** - VP9/HEVC codec support
- **Timeline Comments** - Social video features via scalemule-chat
- **Deep Analytics** - Heatmaps, engagement tracking, TTFF metrics
- **Zero Dependencies** - Custom engine (Phase 3+), no HLS.js in production

---

## Installation

```bash
npm install @scalemule/gallop
```

---

## Quick Start

### React

```tsx
import { GallopPlayer } from '@scalemule/gallop/react';

function VideoPage() {
  return (
    <GallopPlayer
      videoId="your-video-id"
      apiKey="sm_live_xxx"
      onPlay={() => console.log('Playing')}
    />
  );
}
```

### Playback Analytics + Debugging

```tsx
import { GallopPlayer } from '@scalemule/gallop/react';

<GallopPlayer
  videoId="your-video-id"
  apiKey="sm_live_xxx"
  analytics={{
    enabled: true,
    progressIntervalSeconds: 10,
    includeNetworkInfo: true,
    includeDeviceInfo: true,
    debug: false,
  }}
  onEngineStats={({ stats }) => {
    console.log('HLS stats', stats);
  }}
/>;
```

When `analytics.enabled` is on, the player sends playback telemetry to `POST /v1/videos/{id}/track` with:
- Core events: `play`, `pause`, `seek`, `complete`, `buffer`, `error`
- Session ID and playback position
- QoE metadata (TTFF, rebuffer ratio, quality switches)
- Network/device context (when available)

### Web Component

```html
<script type="module">
  import '@scalemule/gallop/element';
</script>

<gallop-player
  video-id="your-video-id"
  api-key="sm_live_xxx"
></gallop-player>
```

### Pre-warming (Instant Start)

```typescript
import { gallop } from '@scalemule/gallop';

// Prewarm on hover for instant playback
thumbnail.addEventListener('mouseenter', () => {
  gallop.prewarm('video-id');
});

// Or use IntersectionObserver for feeds
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      gallop.prewarm(entry.target.dataset.videoId);
    }
  });
}, { rootMargin: '200px' });
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Gallop Web                               │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer                                                        │
│  ├── React Components / Web Components                          │
│  ├── Controls (play, seek, volume, quality)                     │
│  └── Social Features (timeline comments, share)                 │
├─────────────────────────────────────────────────────────────────┤
│  Engine Abstraction                                              │
│  ├── HLSJSEngine (Phase 1-2, temporary)                         │
│  ├── GallopEngine (Phase 3+, custom)                            │
│  └── NativeHLSEngine (iOS Safari fallback)                      │
├─────────────────────────────────────────────────────────────────┤
│  Performance Layer                                               │
│  ├── Pre-warming System                                         │
│  ├── Low-Latency Startup Profile                                │
│  └── Hot-Swap Fallback                                          │
├─────────────────────────────────────────────────────────────────┤
│  Browser APIs                                                    │
│  ├── Media Source Extensions (MSE)                              │
│  ├── Encrypted Media Extensions (EME)                           │
│  └── Web Workers                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Browser Support

| Browser | Version | MSE | DRM |
|---------|---------|-----|-----|
| Chrome | 70+ | ✅ | Widevine |
| Firefox | 78+ | ✅ | Widevine |
| Safari | 14+ | ✅ | FairPlay |
| Edge | 79+ | ✅ | Widevine |
| iOS Safari | 14+ | Native HLS | FairPlay |
| Android Chrome | 70+ | ✅ | Widevine |

---

## Development

### Technology Stack

| Tool | Purpose |
|------|---------|
| TypeScript | Primary language (strict mode) |
| tsup | Build pipeline (ESM + CJS + UMD) |
| Vitest | Unit testing |
| Playwright | E2E testing |

### Scripts

```bash
# Development
npm run dev          # Start dev server with hot reload
npm run build        # Production build
npm run test         # Run unit tests
npm run test:e2e     # Run Playwright tests

# Quality
npm run lint         # ESLint
npm run typecheck    # TypeScript type checking
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Development phases, technical details |
| [Core Architecture](../scalemule-gallop/docs/ARCHITECTURE.md) | Shared architecture decisions |
| [Cross-Platform](../scalemule-gallop/docs/CROSS_PLATFORM.md) | Platform comparison |

---

## Related Repos

- **[scalemule-gallop](../scalemule-gallop)** - Core documentation (shared architecture)
- **[scalemule-gallop-ios](../scalemule-gallop-ios)** - iOS SDK (Swift)
- **[scalemule-gallop-android](../scalemule-gallop-android)** - Android SDK (Kotlin)

---

## License

Proprietary - ScaleMule, Inc.
