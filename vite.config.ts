import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'

// Dev only: POST a canvas data URL to /__shot to save a full-resolution frame in .shots/.
function shots(): Plugin {
  return {
    name: 'dev-shots',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          const name = (new URL(req.url ?? '', 'http://x').searchParams.get('name') || 'shot').replace(/[^a-z0-9-]/gi, '')
          fs.mkdirSync('.shots', { recursive: true })
          fs.writeFileSync(`.shots/${name}.jpg`, Buffer.from(body.split(',')[1] ?? '', 'base64'))
          res.end('ok')
        })
      })
    },
  }
}

// Keep React separate from the 3D libraries so the loader paints before three.js arrives.
function chunkFor(id: string) {
  // tiny shared helpers must live with the entry, or the entry ends up importing the 3D chunks
  if (id.includes('preload-helper') || id.includes('commonjsHelpers')) return 'react'
  if (!id.includes('node_modules')) return undefined
  if (/node_modules[\/](react|react-dom|scheduler|zustand)[\/]/.test(id)) return 'react'
  if (/node_modules[\/]three[\/]/.test(id)) return 'three'
  if (/node_modules[\/](@react-three|postprocessing|three-stdlib|troika-|maath|@monogrid|camera-controls|its-fine|react-reconciler|suspend-react)/.test(id)) return 'r3f'
  return undefined
}

export default defineConfig({
  plugins: [react(), shots()],
  server: { host: true },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: { output: { manualChunks: chunkFor } },
  },
})
