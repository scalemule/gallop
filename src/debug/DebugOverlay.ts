import type { GallopDiagnostics } from '../types';

export interface DebugOverlayConfig {
  version: string;
  mode: 'inline' | 'iframe';
  engineType: string;
  nonceStatus: string;
  cspStatus: string;
  connectionState?: string;
}

/**
 * Redacts sensitive information from debug view.
 */
function redact(val: string | undefined, type: 'key' | 'token' | 'pii'): string {
  if (!val) return 'none';
  if (type === 'token') return 'REDACTED';
  if (type === 'key') return `****${val.slice(-4)}`;
  if (type === 'pii') {
    if (val.length <= 8) return '***';
    return `${val.slice(0, 4)}***${val.slice(-4)}`;
  }
  return val;
}

export class DebugOverlay {
  private container: HTMLElement;
  private contentEl: HTMLDivElement;
  private isExpanded = false;

  constructor(
    private parent: HTMLElement,
    private config: DebugOverlayConfig,
    private getDiagnostics: () => GallopDiagnostics
  ) {
    this.container = document.createElement('div');
    this.container.className = 'gallop-debug-overlay';
    this.container.setAttribute('aria-hidden', 'true');
    this.container.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      font-family: monospace;
      font-size: 10px;
      padding: 5px;
      border-radius: 3px;
      pointer-events: auto;
      max-width: 300px;
      max-height: 80%;
      overflow-y: auto;
      border: 1px solid #333;
    `;

    this.contentEl = document.createElement('div');
    this.container.appendChild(this.contentEl);

    const toggleBtn = document.createElement('div');
    toggleBtn.textContent = '[DEBUG]';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.onclick = () => this.toggle();
    this.container.insertBefore(toggleBtn, this.contentEl);

    this.parent.appendChild(this.container);
    this.update();
    setInterval(() => this.update(), 1000);
  }

  private toggle() {
    this.isExpanded = !this.isExpanded;
    this.container.setAttribute('aria-hidden', (!this.isExpanded).toString());
    if (this.isExpanded) {
      this.container.setAttribute('role', 'log');
    } else {
      this.container.removeAttribute('role');
    }
    this.update();
  }

  private update() {
    if (!this.isExpanded) {
      this.contentEl.innerHTML = '';
      this.container.style.width = 'auto';
      return;
    }

    const diag = this.getDiagnostics();
    const html = `
      <div style="margin-top: 5px; border-top: 1px solid #444; padding-top: 5px;">
        <strong>System</strong><br>
        v: ${this.config.version}<br>
        mode: ${this.config.mode}<br>
        engine: ${this.config.engineType}<br>
        nonce: ${this.config.nonceStatus}<br>
        csp: ${this.config.cspStatus}<br>
        conn: ${this.config.connectionState || 'n/a'}<br>
      </div>
      <div style="margin-top: 5px; border-top: 1px solid #444; padding-top: 5px;">
        <strong>Performance</strong><br>
        bitrate: ${(diag.bitrate / 1000000).toFixed(2)} Mbps<br>
        buffer: ${diag.bufferLength.toFixed(1)}s<br>
        fps: ${diag.fps}<br>
        dropped: ${diag.droppedFrames}<br>
      </div>
      <div style="margin-top: 5px; border-top: 1px solid #444; padding-top: 5px;">
        <button onclick="navigator.clipboard.writeText(JSON.stringify(window.GallopDiagnostics))" style="font-size: 9px; cursor: pointer;">
          Copy JSON Diagnostics
        </button>
      </div>
    `;
    this.contentEl.innerHTML = html;
    // Expose for the copy button
    (window as any).GallopDiagnostics = diag;
  }

  public destroy() {
    this.container.remove();
  }
}
