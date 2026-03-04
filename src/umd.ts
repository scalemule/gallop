import { Gallop } from './factory';
import { bootstrapEmbed } from './embed/EmbedPage';
import { GallopPlayerCore } from './core/GallopPlayerCore';
import './element';

// Re-export all factory methods + bootstrapEmbed as named exports.
// tsup IIFE with globalName='Gallop' maps these to window.Gallop.*.
export const create = Gallop.create.bind(Gallop);
export const createInline = Gallop.createInline.bind(Gallop);
export const createIframe = Gallop.createIframe.bind(Gallop);
export const version = Gallop.version;
export { bootstrapEmbed, GallopPlayerCore };
export type { GallopConfig, GallopEventMap, QualityLevel, PlayerStatus } from './types';
