import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { IEngine, MixAudioOptions, NormalizeOptions, ProgressCallback, ProbeResult } from './EngineInterface'

const CORE_URL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm'

export class WasmEngine implements IEngine {
  private ffmpeg: FFmpeg
  private loaded = false
  private textEncoder = new TextEncoder()

  constructor() {
    this.ffmpeg = new FFmpeg()
  }

  async load(): Promise<void> {
    if (this.loaded) return
    const coreURL = await toBlobURL(`${CORE_URL}/ffmpeg-core.js`, 'text/javascript')
    const wasmURL = await toBlobURL(`${CORE_URL}/ffmpeg-core.wasm`, 'application/wasm')
    const workerURL = await toBlobURL(`${CORE_URL}/ffmpeg-core.worker.js`, 'text/javascript')
    await this.ffmpeg.load({ coreURL, wasmURL, workerURL })
    this.loaded = true
  }

  async probe(file: File): Promise<ProbeResult> {
    await this.load()
    const name = 'probe_input.' + file.name.split('.').pop()
    await this.ffmpeg.writeFile(name, await fetchFile(file))
    let output = ''
    const logger = ({ message }: { message: string }) => { output += message + '\n' }
    this.ffmpeg.on('log', logger)
    // Run with invalid output to force ffmpeg to print stream info and exit
    try {
      await this.ffmpeg.exec(['-i', name, '-f', 'null', '-'])
    } catch {
      // expected non-zero exit
    }
    this.ffmpeg.off('log', logger)
    await this.ffmpeg.deleteFile(name)

    const duration = parseFloat(output.match(/Duration:\s*(\d+):(\d+):([\d.]+)/)?.slice(1).map((v, i) => parseFloat(v) * [3600, 60, 1][i]).reduce((a, b) => a + b, 0).toString() ?? '0') || this._parseDuration(output)
    const videoMatch = output.match(/(\d{2,5})x(\d{2,5})/)
    const fpsMatch = output.match(/([\d.]+)\s*fps/)
    return {
      duration,
      width: parseInt(videoMatch?.[1] ?? '1920'),
      height: parseInt(videoMatch?.[2] ?? '1080'),
      fps: parseFloat(fpsMatch?.[1] ?? '30'),
    }
  }

  private _parseDuration(output: string): number {
    const m = output.match(/Duration:\s*(\d+):(\d+):([\d.]+)/)
    if (!m) return 0
    return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])
  }

  async buildCombination({
    clips,
    music,
    normalizeOptions,
    mixAudioOptions,
    onProgress,
    onStage,
  }: {
    clips: File[]
    music: File | null
    normalizeOptions: NormalizeOptions
    mixAudioOptions: MixAudioOptions
    onProgress?: ProgressCallback
    onStage?: (message: string) => void
  }): Promise<Uint8Array> {
    await this.load()

    const totalSteps = clips.length + (music ? 2 : 1) // normalize each + concat + optional mix
    let step = 0
    const advance = () => { step++; onProgress?.(step / totalSteps) }

    const logs: string[] = []
    const logger = ({ message }: { message: string }) => {
      logs.push(message)
      if (logs.length > 120) logs.shift()
    }
    this.ffmpeg.on('log', logger)

    try {
      onStage?.('Cistim predchozi docasne soubory')
      await this._cleanupTempFiles()

      // 1. Write and normalize each clip
      const normalizedNames: string[] = []
      for (let i = 0; i < clips.length; i++) {
        onStage?.(`Normalizuji klip ${i + 1}/${clips.length}`)
        const clip = clips[i]
        const ext = clip.name.split('.').pop() ?? 'mp4'
        const inputName = `clip_${i}.${ext}`
        const outputName = `norm_${i}.mp4`
        await this.ffmpeg.writeFile(inputName, await fetchFile(clip))
        const { width, height, fps } = normalizeOptions

        const normalizeArgs = [
          '-y',
          '-i', inputName,
          '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps}`,
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
          ...(mixAudioOptions.replaceOriginalAudio ? ['-an'] : ['-c:a', 'aac']),
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          outputName,
        ]

        await this.ffmpeg.exec(normalizeArgs)
        await this._safeDelete(inputName)
        normalizedNames.push(outputName)
        advance()
      }

      // 2. Concat
      onStage?.('Spojuji klipy')
      const concatListContent = normalizedNames.map((n) => `file '${n}'`).join('\n')
      await this.ffmpeg.writeFile('concat_list.txt', this.textEncoder.encode(concatListContent))
      const concatOutput = 'concat_out.mp4'
      await this.ffmpeg.exec([
        '-y',
        '-f', 'concat', '-safe', '0',
        '-i', 'concat_list.txt',
        '-c', 'copy',
        concatOutput,
      ])
      for (const n of normalizedNames) await this._safeDelete(n)
      await this._safeDelete('concat_list.txt')
      advance()

      let finalOutput = concatOutput

      // 3. Mix audio
      if (music) {
        onStage?.(mixAudioOptions.replaceOriginalAudio ? 'Pridavam hudbu (nahrazeni puvodniho audia)' : 'Micham voiceover a hudbu')
        const musicExt = music.name.split('.').pop() ?? 'mp3'
        const musicName = `music.${musicExt}`
        await this.ffmpeg.writeFile(musicName, await fetchFile(music))

        const mixedOutput = 'mixed_out.mp4'

        // Get concat duration for fade-out timing
        const probe = await this._probeName(concatOutput)
        const duration = probe.duration
        const hasOriginalAudio = probe.hasAudio

        const musicFilterParts = [`volume=${Math.max(0, mixAudioOptions.musicVolume).toFixed(2)}`]
        if (mixAudioOptions.fadeOut) {
          musicFilterParts.push(
            `afade=t=out:st=${Math.max(0, duration - mixAudioOptions.fadeOutDuration)}:d=${mixAudioOptions.fadeOutDuration}`
          )
        }
        const musicFilter = musicFilterParts.join(',')

        if (!mixAudioOptions.replaceOriginalAudio && hasOriginalAudio) {
          await this.ffmpeg.exec([
            '-y',
            '-i', concatOutput,
            '-stream_loop', '-1', '-i', musicName,
            '-filter_complex', `[1:a]${musicFilter}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
            '-map', '0:v:0',
            '-map', '[aout]',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-shortest',
            mixedOutput,
          ])
        } else {
          await this.ffmpeg.exec([
            '-y',
            '-i', concatOutput,
            '-stream_loop', '-1', '-i', musicName,
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-vcodec', 'copy',
            '-acodec', 'aac',
            '-af', musicFilter,
            '-shortest',
            mixedOutput,
          ])
        }

        await this._safeDelete(concatOutput)
        await this._safeDelete(musicName)
        finalOutput = mixedOutput
        advance()
      }

      if (!music) {
        onStage?.('Dokoncuji export bez hudby')
      }

      try {
        onStage?.('Nacitam vystupni soubor')
        const data = await this.ffmpeg.readFile(finalOutput)
        await this._safeDelete(finalOutput)
        onStage?.('Hotovo')
        return data as Uint8Array
      } catch {
        throw new Error(`Nepodarilo se nacist vystupni soubor ${finalOutput} z ffmpeg FS. ${this._tailLogs(logs)}`)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      throw new Error(`${msg}. ${this._tailLogs(logs)}`)
    } finally {
      this.ffmpeg.off('log', logger)
    }
  }

  private async _probeName(name: string): Promise<{ duration: number; hasAudio: boolean }> {
    let output = ''
    const logger = ({ message }: { message: string }) => { output += message + '\n' }
    this.ffmpeg.on('log', logger)
    try { await this.ffmpeg.exec(['-i', name, '-f', 'null', '-']) } catch { /* expected */ }
    this.ffmpeg.off('log', logger)
    return { duration: this._parseDuration(output), hasAudio: /Audio:\s/.test(output) }
  }

  private async _safeDelete(path: string): Promise<void> {
    try {
      await this.ffmpeg.deleteFile(path)
    } catch {
      // File may already be missing in ffmpeg FS; ignore cleanup errors.
    }
  }

  private _tailLogs(logs: string[]): string {
    if (logs.length === 0) return 'FFmpeg nevratil zadny log.'
    return `Posledni ffmpeg logy: ${logs.slice(-6).join(' | ')}`
  }

  private async _cleanupTempFiles(): Promise<void> {
    await this._safeDelete('concat_list.txt')
    await this._safeDelete('concat_out.mp4')
    await this._safeDelete('mixed_out.mp4')
    await this._safeDelete('music.mp3')
    await this._safeDelete('music.wav')
    await this._safeDelete('music.m4a')
    await this._safeDelete('music.aac')

    // Best-effort cleanup for known temp naming pattern.
    for (let i = 0; i < 30; i++) {
      await this._safeDelete(`norm_${i}.mp4`)
      await this._safeDelete(`clip_${i}.mp4`)
      await this._safeDelete(`clip_${i}.mov`)
      await this._safeDelete(`clip_${i}.webm`)
      await this._safeDelete(`clip_${i}.mkv`)
    }
  }
}
