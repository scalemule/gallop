export const PLAYER_STYLES = `
/* ===== Gallop Player — ScaleMule Video Player ===== */

/* --- Foundation --- */
.gallop-player {
  position: relative;
  width: 100%;
  max-width: 100%;
  background: #000;
  overflow: hidden;
  border-radius: var(--gallop-border-radius, 8px);
  font-family: var(--gallop-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  font-size: var(--gallop-font-size, 13px);
  color: #fff;
  user-select: none;
  -webkit-user-select: none;
  outline: none;
  line-height: 1.4;
}

.gallop-player * {
  box-sizing: border-box;
}

.gallop-player.gallop-fullscreen {
  border-radius: 0;
  width: 100vw;
  height: 100vh;
  max-width: none;
  aspect-ratio: auto !important;
}

.gallop-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* --- Icon base --- */
.gallop-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--gallop-icon-size, 22px);
  height: var(--gallop-icon-size, 22px);
  flex-shrink: 0;
}
.gallop-icon svg {
  width: 100%;
  height: 100%;
}

/* ===================================================
   BIG PLAY BUTTON — Signature rounded-rect with gradient
   =================================================== */
.gallop-big-play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  /* YouTube-style centered overlay button — solid brand color, fully opaque,
     soft drop shadow for separation from any background. ScaleMule blue is
     the default; hosts override via the --gallop-big-play-bg custom property
     when they need to match their own palette. Size scales with the player
     (clamped both ends) and the square aspect keeps the circle round. */
  width: clamp(52px, 12%, 88px);
  height: clamp(52px, 12%, 88px);
  border-radius: 50%;
  background: var(--gallop-big-play-bg, #3b82f6);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  opacity: 1;
  transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  z-index: 4;
  padding: 0;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.32);
}

.gallop-big-play:hover {
  transform: translate(-50%, -50%) scale(1.06);
  background: var(--gallop-big-play-bg-hover, #1d4ed8);
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.42);
}

.gallop-big-play .gallop-icon {
  /* 40% of the button — perfectly centered. The play SVG path is already
     visually balanced (M6.9..18.6 in a 24-unit viewBox), so no margin shim
     is needed; previous versions over-corrected and made it look off-center. */
  width: 40%;
  height: 40%;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
}

/* Replay variant — same shape, dimmer fill so a finished video reads as
   "completed" rather than "ready to start". */
.gallop-big-play[data-mode="replay"] {
  background: var(--gallop-big-play-bg-replay, rgba(0, 0, 0, 0.6));
}
.gallop-big-play[data-mode="replay"]:hover {
  background: var(--gallop-big-play-bg-replay-hover, rgba(0, 0, 0, 0.78));
}
.gallop-big-play[data-mode="replay"] .gallop-icon {
  /* The replay arrow is symmetric — slightly larger so it reads at a glance. */
  width: 46%;
  height: 46%;
}

.gallop-big-play[hidden] {
  display: none;
}

/* When controls are visible during pause, dim the big play button slightly */
.gallop-player[data-status="paused"] .gallop-big-play {
  opacity: 0.85;
}

/* ===================================================
   LOADING SPINNER — Brand-colored ring
   =================================================== */
.gallop-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
  z-index: 3;
}
.gallop-spinner[hidden] { display: none; }

.gallop-spinner-ring {
  width: 100%;
  height: 100%;
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--gallop-color-primary, #635bff);
  border-radius: 50%;
  animation: gallop-spin 0.8s linear infinite;
}

@keyframes gallop-spin {
  to { transform: rotate(360deg); }
}

/* ===================================================
   POSTER IMAGE
   =================================================== */
.gallop-poster {
  position: absolute;
  inset: 0;
  z-index: 2;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: opacity 0.4s ease;
}
.gallop-poster[hidden] { display: none; }

/* ===================================================
   ERROR OVERLAY
   =================================================== */
.gallop-error {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.gallop-error[hidden] { display: none; }

.gallop-error-message {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.75);
  text-align: center;
  max-width: 80%;
}

.gallop-error-retry {
  padding: 10px 28px;
  background: var(--gallop-color-primary, #635bff);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}
.gallop-error-retry:hover {
  transform: scale(1.04);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

/* ===================================================
   CONTROL BAR — Floating rounded pill
   =================================================== */
.gallop-controls {
  position: absolute;
  bottom: 10px;
  left: 10px;
  right: 10px;
  z-index: 10;
  background: var(--gallop-control-bar-bg, rgba(0, 0, 0, 0.65));
  border-radius: 22px;
  padding: 0;
  opacity: 1;
  transition: opacity 0.35s ease;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Hide controls during active playback (not paused/idle/ready/ended) */
.gallop-player:not(:hover):not(:focus-within):not([data-status="paused"]):not([data-status="idle"]):not([data-status="ready"]):not([data-status="ended"]) .gallop-controls.gallop-controls-hidden {
  opacity: 0;
  pointer-events: none;
}

/* YouTube-embed parity: hide the bottom control bar entirely before first
   playback. The big play button is the only chrome the user sees in the
   idle / ready states. Once they click play, the existing fade rules above
   take over (controls auto-hide during playback, reappear on hover/pause). */
.gallop-player[data-status="idle"] .gallop-controls,
.gallop-player[data-status="ready"] .gallop-controls {
  opacity: 0;
  pointer-events: none;
}

/* Also hide big play button during active playback when controls hidden */
.gallop-player:not(:hover):not(:focus-within)[data-status="playing"] .gallop-big-play {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.35s ease;
}

.gallop-controls-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--gallop-control-bar-height, 44px);
  padding: 0 6px 0 8px;
}

/* --- Control Buttons --- */
.gallop-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s, transform 0.15s;
  position: relative;
}
.gallop-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  transform: scale(1.05);
}

/* ===================================================
   PROGRESS BAR — Thick, bold, TikTok-inspired
   =================================================== */
.gallop-progress-container {
  flex: 1;
  min-width: 0;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.gallop-progress-bar {
  position: relative;
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  transition: height 0.15s ease;
}

.gallop-progress-container:hover .gallop-progress-bar {
  height: 6px;
}

.gallop-progress-buffered {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.22);
  border-radius: 2px;
  pointer-events: none;
}

.gallop-progress-played {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--gallop-color-progress, var(--gallop-color-primary, #635bff));
  border-radius: 2px;
  pointer-events: none;
}

.gallop-progress-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: #fff;
  border: 2px solid var(--gallop-color-primary, #635bff);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.15s, transform 0.15s;
  pointer-events: none;
}

.gallop-progress-container:hover .gallop-progress-thumb {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1.1);
}

/* ===================================================
   VOLUME
   =================================================== */
.gallop-volume {
  display: flex;
  align-items: center;
  gap: 4px;
}

.gallop-volume-slider-wrap {
  width: 0;
  overflow: hidden;
  transition: width 0.2s ease;
}
.gallop-volume:hover .gallop-volume-slider-wrap,
.gallop-volume-slider-wrap.gallop-volume-expanded {
  width: 64px;
}

.gallop-volume-slider {
  width: 64px;
  height: 4px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 2px;
  position: relative;
  cursor: pointer;
}
.gallop-volume-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 2px;
  pointer-events: none;
}

/* ===================================================
   TIME DISPLAY
   =================================================== */
.gallop-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  min-width: 40px;
  letter-spacing: 0.02em;
}

/* Spacer */
.gallop-spacer { flex: 1; }

/* ===================================================
   SETTINGS MENU
   =================================================== */
.gallop-settings-menu {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 8px;
  min-width: 200px;
  background: var(--gallop-color-background, rgba(24, 24, 32, 0.92));
  border-radius: 12px;
  padding: 6px 0;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 20;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
.gallop-settings-menu[hidden] { display: none; }

.gallop-settings-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  color: rgba(255, 255, 255, 0.9);
}
.gallop-settings-header .gallop-icon {
  width: 18px;
  height: 18px;
}

.gallop-settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.12s;
  font-size: 13px;
  gap: 12px;
  color: rgba(255, 255, 255, 0.8);
}
.gallop-settings-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.gallop-settings-item-active .gallop-icon {
  color: var(--gallop-color-primary, #635bff);
}

.gallop-settings-value {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

/* ===================================================
   CONTEXT MENU
   =================================================== */
.gallop-context-menu {
  position: absolute;
  z-index: 30;
  min-width: 180px;
  background: var(--gallop-color-background, rgba(24, 24, 32, 0.94));
  border-radius: 10px;
  padding: 4px 0;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}
.gallop-context-menu[hidden] { display: none; }

.gallop-context-menu-item {
  padding: 9px 14px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: background 0.12s;
  white-space: nowrap;
}
.gallop-context-menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* ===================================================
   GALLOP BRANDING WATERMARK
   =================================================== */
.gallop-brand {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 6px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
}

.gallop-brand-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--gallop-color-primary, #635bff);
  flex-shrink: 0;
}

/* Show branding on hover */
.gallop-player:hover .gallop-brand,
.gallop-player:focus-within .gallop-brand,
.gallop-player[data-status="paused"] .gallop-brand,
.gallop-player[data-status="idle"] .gallop-brand,
.gallop-player[data-status="ready"] .gallop-brand,
.gallop-player[data-status="ended"] .gallop-brand {
  opacity: 1;
  pointer-events: auto;
}
`;
