import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')

const files = [
  { url: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js', dest: 'public/ffmpeg-st/ffmpeg-core.js' },
  { url: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm', dest: 'public/ffmpeg-st/ffmpeg-core.wasm' },
  { url: 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm/ffmpeg-core.js', dest: 'public/ffmpeg-mt/ffmpeg-core.js' },
  { url: 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm/ffmpeg-core.wasm', dest: 'public/ffmpeg-mt/ffmpeg-core.wasm' },
  { url: 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm/ffmpeg-core.worker.js', dest: 'public/ffmpeg-mt/ffmpeg-core.worker.js' },
]

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const fullDest = path.join(projectRoot, dest)
    console.log(`Downloading ${url} -> ${dest}...`)
    
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: ${url} (${res.statusCode})`))
        return
      }
      
      const writeStream = fs.createWriteStream(fullDest)
      res.pipe(writeStream)
      
      writeStream.on('finish', () => {
        writeStream.close()
        const stats = fs.statSync(fullDest)
        console.log(`✓ ${dest} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)
        resolve()
      })
      
      writeStream.on('error', reject)
    }).on('error', reject)
  })
}

async function main() {
  try {
    console.log('Downloading FFmpeg WASM files...\n')
    for (const file of files) {
      await downloadFile(file.url, file.dest)
    }
    console.log('\n✓ All files downloaded successfully!')
  } catch (error) {
    console.error('✗ Download failed:', error.message)
    process.exit(1)
  }
}

main()
