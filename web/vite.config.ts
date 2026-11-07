import { execFileSync } from 'node:child_process'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

const here = import.meta.dirname
const repo = resolve(here, '..')

// `just dev` sets API_PORT (web runs on API_PORT + 1). Without it, ask scripts/port.sh. Never hardcoded.
// Dev server only: `vite build` (e.g. in Docker, which has no scripts/) must not need a port.
const devApiPort = () => process.env.API_PORT ?? execFileSync(resolve(repo, 'scripts/port.sh')).toString().trim()

// Dev only: serve the repo's assets/clubs at /assets/clubs. The Dockerfile copies the same folder
// into web/public/assets/clubs for the build, so there is no symlink or copy here.
function repoClubAssets(): Plugin {
  const root = resolve(repo, 'assets/clubs')
  return {
    name: 'repo-club-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/assets/clubs', (req, res, next) => {
        const file = resolve(root, '.' + decodeURIComponent((req.url ?? '/').split('?')[0]))
        if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) return next()
        const types: Record<string, string> = {
          json: 'application/json', glb: 'model/gltf-binary', usdz: 'model/vnd.usdz+zip', webp: 'image/webp',
        }
        res.setHeader('Content-Type', types[file.split('.').pop() ?? ''] ?? 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
  }
}

export default defineConfig(({ command }) => {
  const apiPort = command === 'serve' ? devApiPort() : undefined
  return {
    plugins: [react(), tailwindcss(), repoClubAssets()],
    resolve: { alias: { '@': resolve(here, 'src'), '@fixtures': resolve(repo, 'fixtures') } },
    server: apiPort
      ? {
          fs: { allow: [repo] }, // dev.html reads ../fixtures
          // --strictPort and --port come from `just dev`; the fallback keeps `pnpm dev` working alone.
          port: Number(apiPort) + 1,
          proxy: { '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true } },
        }
      : undefined,
    build: {
      rollupOptions: {
        input: {
          index: resolve(here, 'index.html'),
          studio: resolve(here, 'studio.html'),
          dev: resolve(here, 'dev.html'),
          ar: resolve(here, 'ar.html'),
        },
      },
    },
  }
})
