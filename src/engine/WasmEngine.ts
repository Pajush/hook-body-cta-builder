import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { IEngine, MixAudioOptions, NormalizeOptions, ProgressCallback, ProbeResult } from './EngineInterface'

const CORE_URL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm'

export class WasmEngine implements IEngine {
  private ffmpeg: FFmpeg
  private loaded = false
  private textEncoder = new TextEncoder()
  private normalizedVideoCache = new Map<string, string>()
  private normalizedAudioCache = new Map<string, string>()

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

  private _getVideoCacheKey(clip: File, normalizeOptions: NormalizeOptions): string {
    return [
      clip.name,
      clip.size,
      clip.lastModified,
      normalizeOptions.width,
      normalizeOptions.height,
      normalizeOptions.fps,
    ].join('|')
  }

  private _getAudioCacheKey(clip: File): string {
    return [clip.name, clip.size, clip.lastModified].join('|')
  }

  private _createCacheFileName(prefix: string, ext: string): string {
    const id = Math.random().toString(36).slice(2, 8)
    return `${prefix}_${Date.now()}_${id}.${ext}`
  }

  private _getOrCreateCachedVideoName(key: string): string {
    let name = this.normalizedVideoCache.get(key)
    if (!name) {
      name = this._createCacheFileName('norm_cache', 'mp4')
      this.normalizedVideoCache.set(key, name)
    }
    return name
  }

  private _getOrCreateCachedAudioName(key: string): string {
    let name = this.normalizedAudioCache.get(key)
    if (!name) {
      name = this._createCacheFileName('aud_cache', 'm4a')
      this.normalizedAudioCache.set(key, name)
    }
    return name
  }

  private async _fileExists(path: string): Promise<boolean> {
    try {
      await this.ffmpeg.readFile(path)
      return true
    } catch {
      return false
    }
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
      const normalizedAudioNames: string[] = []
      for (let i = 0; i < clips.length; i++) {
        onStage?.(`Pripravuji klip ${i + 1}/${clips.length}`)
        const clip = clips[i]
        const ext = clip.name.split('.').pop() ?? 'mp4'
        const inputName = `clip_${i}.${ext}`
        const outputName = this._getOrCreateCachedVideoName(this._getVideoCacheKey(clip, normalizeOptions))
        const { width, height, fps } = normalizeOptions

        if (!(await this._fileExists(outputName))) {
          onStage?.(`Normalizuji video ${i + 1}/${clips.length}`)
          await this.ffmpeg.writeFile(inputName, await fetchFile(clip))
          const normalizeArgs = [
            '-y',
            '-i', inputName,
            '-map', '0:v:0',
            // Fill target frame and crop from center instead of letterboxing.
            '-vf', `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps},setsar=1`,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
            '-an',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            outputName,
          ]
          await this.ffmpeg.exec(normalizeArgs)
          await this._safeDelete(inputName)
        } else {
          onStage?.(`Pouzivam cache videa ${i + 1}/${clips.length}`)
        }

        // Preserve original audio as a separate normalized stream to avoid hangs in combined AV transcode.
        if (!mixAudioOptions.replaceOriginalAudio) {
          const audioOutputName = this._getOrCreateCachedAudioName(this._getAudioCacheKey(clip))
          if (!(await this._fileExists(audioOutputName))) {
            onStage?.(`Normalizuji puvodni audio ${i + 1}/${clips.length}`)
            if (!(await this._fileExists(inputName))) {
              await this.ffmpeg.writeFile(inputName, await fetchFile(clip))
            }
            try {
              await this.ffmpeg.exec([
                '-y',
                '-i', inputName,
                '-vn',
                '-map', '0:a:0',
                '-c:a', 'aac',
                '-ar', '48000',
                '-ac', '2',
                audioOutputName,
              ])
            } catch {
              // Clip may not contain an audio track; continue without this audio segment.
              await this._safeDelete(audioOutputName)
            }
            await this._safeDelete(inputName)
          } else {
            onStage?.(`Pouzivam cache puvodniho audia ${i + 1}/${clips.length}`)
          }

          if (await this._fileExists(audioOutputName)) {
            normalizedAudioNames.push(audioOutputName)
          }
        }

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
      await this._safeDelete('concat_list.txt')
      advance()

      let finalOutput = concatOutput
      let preservedAudioOutput: string | null = null

      // 2b. Concat original audio (if requested and present)
      if (!mixAudioOptions.replaceOriginalAudio && normalizedAudioNames.length > 0) {
        onStage?.('Spojuji puvodni audio stopy')
        const audioConcatList = normalizedAudioNames.map((n) => `file '${n}'`).join('\n')
        await this.ffmpeg.writeFile('concat_audio_list.txt', this.textEncoder.encode(audioConcatList))
        preservedAudioOutput = 'concat_original_audio.m4a'
        await this.ffmpeg.exec([
          '-y',
          '-f', 'concat', '-safe', '0',
          '-i', 'concat_audio_list.txt',
          '-c', 'copy',
          preservedAudioOutput,
        ])

        await this._safeDelete('concat_audio_list.txt')
      }

      // 2c. If keeping original audio and no music, mux video + original audio and finish.
      if (!music && preservedAudioOutput) {
        onStage?.('Pridavam puvodni audio (voiceover)')
        const muxedOutput = 'muxed_with_original_audio.mp4'
        await this.ffmpeg.exec([
          '-y',
          '-i', concatOutput,
          '-i', preservedAudioOutput,
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-shortest',
          muxedOutput,
        ])
        await this._safeDelete(concatOutput)
        await this._safeDelete(preservedAudioOutput)
        finalOutput = muxedOutput
      }

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
        const hasOriginalAudio = Boolean(preservedAudioOutput)

        const musicFilterParts = [`volume=${Math.max(0, mixAudioOptions.musicVolume).toFixed(2)}`]
        if (mixAudioOptions.fadeOut) {
          musicFilterParts.push(
            `afade=t=out:st=${Math.max(0, duration - mixAudioOptions.fadeOutDuration)}:d=${mixAudioOptions.fadeOutDuration}`
          )
        }
        const musicFilter = musicFilterParts.join(',')

        if (!mixAudioOptions.replaceOriginalAudio && hasOriginalAudio && preservedAudioOutput) {
          await this.ffmpeg.exec([
            '-y',
            '-i', concatOutput,
            '-i', preservedAudioOutput,
            '-stream_loop', '-1', '-i', musicName,
            '-filter_complex', `[2:a]${musicFilter}[bg];[1:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
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
        if (preservedAudioOutput) await this._safeDelete(preservedAudioOutput)
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
    await this._safeDelete('concat_audio_list.txt')
    await this._safeDelete('concat_out.mp4')
    await this._safeDelete('mixed_out.mp4')
    await this._safeDelete('concat_original_audio.m4a')
    await this._safeDelete('muxed_with_original_audio.mp4')
    await this._safeDelete('music.mp3')
    await this._safeDelete('music.wav')
    await this._safeDelete('music.m4a')
    await this._safeDelete('music.aac')

    // Best-effort cleanup for known transient naming pattern.
    for (let i = 0; i < 30; i++) {
      await this._safeDelete(`norm_${i}.mp4`)
      await this._safeDelete(`aud_${i}.m4a`)
      await this._safeDelete(`clip_${i}.mp4`)
      await this._safeDelete(`clip_${i}.mov`)
      await this._safeDelete(`clip_${i}.webm`)
      await this._safeDelete(`clip_${i}.mkv`)
    }
  }
}
