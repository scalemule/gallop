export { PostMessageBridge } from './PostMessageBridge';
export type { GallopMessage } from './PostMessageBridge';
export { bootstrapEmbed } from './EmbedPage';

// Auto-bootstrap: this entry is built as a self-contained IIFE (gallop.embed.global.js)
// that gets inlined into the embed HTML shell. It must auto-execute on load.
import { bootstrapEmbed as _boot } from './EmbedPage';
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }
}
