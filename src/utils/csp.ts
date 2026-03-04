/**
 * Utility to resolve a CSP nonce from the environment.
 * It checks the provided explicit nonce, the current script's nonce,
 * and finally scans the DOM for any script or style tags with a nonce.
 */
export function resolveNonce(explicitNonce?: string): string | undefined {
  if (explicitNonce) return explicitNonce;

  // Try to get nonce from the script that loaded this code
  if (typeof document !== 'undefined' && document.currentScript instanceof HTMLScriptElement && document.currentScript.nonce) {
    return document.currentScript.nonce;
  }

  // Fallback: Scan DOM for any element with a nonce (best effort)
  if (typeof document !== 'undefined') {
    const el = document.querySelector('script[nonce], style[nonce]');
    if (el) {
      return (el as HTMLElement).nonce || el.getAttribute('nonce') || undefined;
    }
  }

  return undefined;
}

/**
 * Detects CSP failures when injecting styles.
 * Uses a three-layer approach:
 * 1. Listening for 'securitypolicyviolation' events.
 * 2. Probing computed styles after an animation frame.
 * 3. Checking the style sheet object directly.
 */
export function detectCSPFailure(
  styleEl: HTMLStyleElement,
  onFailure: (msg: string) => void
): void {
  if (typeof document === 'undefined') return;

  // Layer 1: SecurityPolicyViolation event
  const violationHandler = (e: SecurityPolicyViolationEvent) => {
    if (e.blockedURI === 'inline' || e.violatedDirective.startsWith('style-src')) {
      onFailure(`CSP blocked style injection: ${e.violatedDirective}`);
      cleanup();
    }
  };
  document.addEventListener('securitypolicyviolation', violationHandler as any);

  // Layer 2: Computed style probe
  // We check if a known class injected by the player has its expected style.
  requestAnimationFrame(() => {
    const testEl = styleEl.parentElement?.querySelector('.gallop-player');
    if (testEl) {
      const computed = getComputedStyle(testEl);
      // Assuming .gallop-player always has position: relative or absolute
      if (computed.position === 'static') {
        onFailure('CSP may have blocked style injection (computed style mismatch)');
        cleanup();
      }
    }
  });

  // Layer 3: style.sheet check
  // If the sheet property is null, the browser blocked the style block.
  setTimeout(() => {
    if (!styleEl.sheet) {
      onFailure('Style sheet not applied (sheet is null)');
      cleanup();
    }
  }, 100);

  const cleanup = () => {
    document.removeEventListener('securitypolicyviolation', violationHandler as any);
  };

  // Final cleanup after detection window (2s)
  setTimeout(cleanup, 2000);
}
