import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Plugin to serve media assets from external media-assets directory
function mediaAssetsPlugin() {
  const mediaDir = path.resolve(__dirname, '../../media-assets')

  const serveStaticMedia = (req, res, next) => {
    let targetFile = null

    if (req.url) {
      const urlPath = req.url.split('?')[0]

      if (urlPath.startsWith('/media-assets/')) {
        const relPath = decodeURIComponent(urlPath.replace(/^\/media-assets\//, ''))
        targetFile = path.join(mediaDir, relPath)
      } else if (urlPath.startsWith('/videos/')) {
        // Backwards compatibility fallback for /videos/ paths
        const videoName = decodeURIComponent(urlPath.replace(/^\/videos\//, ''))
        const bgPath = path.join(mediaDir, 'videos', 'backgrounds', videoName)
        const unrefPath = path.join(mediaDir, 'videos', 'unreferenced', videoName)
        if (fs.existsSync(bgPath)) {
          targetFile = bgPath
        } else if (fs.existsSync(unrefPath)) {
          targetFile = unrefPath
        }
      }
    }

    if (targetFile && targetFile.startsWith(mediaDir) && fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
      const ext = path.extname(targetFile).toLowerCase()
      const mimeTypes = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
      }
      const contentType = mimeTypes[ext] || 'application/octet-stream'
      const stat = fs.statSync(targetFile)
      const fileSize = stat.size
      const range = req.headers.range

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunksize = end - start + 1
        const file = fs.createReadStream(targetFile, { start, end })
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
        }
        res.writeHead(206, head)
        return file.pipe(res)
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
        }
        res.writeHead(200, head)
        return fs.createReadStream(targetFile).pipe(res)
      }
    }

    next()
  }

  return {
    name: 'media-assets-server',
    configureServer(server) {
      server.middlewares.use(serveStaticMedia)
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveStaticMedia)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mediaAssetsPlugin()],
  resolve: {
    alias: {
      '@media': path.resolve(__dirname, '../../media-assets'),
    },
  },
  server: {
    fs: {
      allow: ['..', path.resolve(__dirname, '../../media-assets')],
    },
  },
})
