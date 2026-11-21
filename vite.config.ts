/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createRequire } from 'node:module';

function canLoad(mod: string): boolean {
  try {
    createRequire(import.meta.url)(mod);
    return true;
  } catch {
    return false;
  }
}

export default defineConfig({
  base: '/',
  // lightningcss ships native binaries only; fall back to no CSS minification where they can't load
  // (e.g. Termux on Android). The stylesheet is small either way.
  build: { cssMinify: canLoad('lightningcss') ? 'lightningcss' : false },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/**/*'],
      manifest: {
        name: 'Spellcross',
        short_name: 'Spellcross',
        description: 'A match-3 spell-casting journey.',
        orientation: 'landscape',
        display: 'fullscreen',
        background_color: '#2b1b0e',
        theme_color: '#66401A',
        icons: [{ src: 'assets/icons/icon_book.png', sizes: '192x192', type: 'image/png' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,jpg,ttf,json}'], maximumFileSizeToCacheInBytes: 5_000_000 },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
