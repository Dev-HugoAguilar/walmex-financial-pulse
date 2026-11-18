import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * El tablero se compila a UN módulo ESM (`app.js` con `mount`/`unmount`) más su
 * hoja de estilos (`app.css`) dentro de `dist/dashboards/pulso-comercial/`.
 * El portafolio lo carga con `import()` dinámico desde
 * `dist/projects/pulso-comercial.js`, así que el resto del sitio no cambia.
 */
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    // Vite 8 empaqueta con rolldown: se usa su minificador por omisión.
    minify: true,
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    sourcemap: false,
    lib: {
      entry: 'src/mount.tsx',
      formats: ['es'],
      fileName: () => 'app.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (info) =>
          (info.names?.[0] ?? info.name ?? '').endsWith('.css') ? 'app.css' : 'app.[ext]',
      },
    },
  },
});
