import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Die App liegt auf GitHub Pages unter https://maxslobster.github.io/casa/
export default defineConfig({
  base: '/casa/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Casa',
        short_name: 'Casa',
        description: 'Notizbuch für zwei',
        lang: 'de',
        start_url: '/casa/',
        scope: '/casa/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F5F1E8',
        theme_color: '#F5F1E8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Startbilder braucht nur iOS beim Hinzufügen, nicht der Offline-Cache
        globIgnores: ['**/splash/**'],
      },
      devOptions: { enabled: false },
    }),
  ],
})
