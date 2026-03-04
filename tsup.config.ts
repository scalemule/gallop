import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM + CJS library builds (tree-shakeable)
  {
    entry: {
      index: 'src/index.ts',
      element: 'src/element.ts',
      react: 'src/react.tsx',
      iframe: 'src/iframe/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: false,
    clean: true,
    external: ['react', 'react-dom'],
    treeshake: true,
    splitting: true,
  },
  // UMD bundle (script tag usage — includes factory + bootstrapEmbed)
  {
    entry: { 'gallop.umd': 'src/umd.ts' },
    format: ['iife'],
    globalName: 'Gallop',
    sourcemap: false,
    minify: true,
  },
  // Embed bundle (self-contained IIFE for inlining into iframe HTML shell)
  {
    entry: { 'gallop.embed': 'src/embed/index.ts' },
    format: ['iife'],
    globalName: 'GallopEmbed',
    sourcemap: false,
    minify: true,
  },
]);
