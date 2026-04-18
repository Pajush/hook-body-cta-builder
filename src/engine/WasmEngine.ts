import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { IEngine, MixAudioOptions, NormalizeOptions, ProgressCallback, ProbeResult } from './EngineInterface'
import { tr } from '../i18n/dictionary'

// Local paths (bundled with the app)
const LOCAL_URLS = {
  multithread: '/ffmpeg-mt',
  singlethread: '/ffmpeg-st',
}

// Fallback CDN URLs if local files are not available
const CDN_URLS = {
  multithread: [
    'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm',
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/esm',
  ],
  singlethread: [
    'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
  ],
}

export class WasmEngine implements IEngine {
  private ffmpeg: FFmpeg
  private loaded = false
  private textEncoder = new TextEncoder()
  private normalizedVideoCache = new Map<string, string>()
  private normalizedAudioCache = new Map<string, string>()

  constructor() {
    this.ffmpeg = new FFmpeg()
  }

  private async _tryLoadFromUrl(baseUrl: string, canUseMultithread: boolean, timeoutMs: number): Promise<boolean> {
    try {
      console.log('[WasmEngine] Trying:', baseUrl)
      
      const fetchWithTimeout = (url: string, type: string) => {
        return Promise.race([
          toBlobURL(url, type),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout fetching ${url}`)), timeoutMs)
          ),
        ])
      }

      const coreURL = await fetchWithTimeout(`${baseUrl}/ffmpeg-core.js`, 'text/javascript')
      const wasmURL = await fetchWithTimeout(`${baseUrl}/ffmpeg-core.wasm`, 'application/wasm')

      console.log('[WasmEngine] Blob URLs created, loading FFmpeg...')

      if (canUseMultithread) {
        const workerURL = await fetchWithTimeout(`${baseUrl}/ffmpeg-core.worker.js`, 'text/javascript')
        await this.ffmpeg.load({ coreURL, wasmURL, workerURL })
      } else {
        await this.ffmpeg.load({ coreURL, wasmURL })
      }

      console.log('[WasmEngine] FFmpeg loaded successfully from:', baseUrl)
      return true
    } catch (error) {
      console.warn('[WasmEngine] Failed to load from', baseUrl, ':', error)
      return false
    }
  }

  async load(): Promise<void> {
    if (this.loaded) return

    try {
      const canUseMultithread =
        typeof globalThis.SharedArrayBuffer !== 'undefined' && globalThis.crossOriginIsolated === true
      console.log('[WasmEngine] Multithread support:', canUseMultithread)

      // Try local first (bundled with the app)
      const localUrl = canUseMultithread ? LOCAL_URLS.multithread : LOCAL_URLS.singlethread
      console.log('[WasmEngine] Attempting to load from local bundle:', localUrl)
      
      if (await this._tryLoadFromUrl(localUrl, canUseMultithread, 15000)) {
        this.loaded = true
        return
      }

      // Fall back to CDNs
      console.log('[WasmEngine] Local bundle not available, falling back to CDNs...')
      const cdnUrls = canUseMultithread ? CDN_URLS.multithread : CDN_URLS.singlethread
      const timeoutPerCdn = 30000
      for (const baseUrl of cdnUrls) {
        const success = await this._tryLoadFromUrl(baseUrl, canUseMultithread, timeoutPerCdn)
        if (success) {
          this.loaded = true
          return
        }
      }

      // All attempts failed
      throw new Error(`All FFmpeg sources failed. Tried: local bundle, ${cdnUrls.join(', ')}`)
    } catch (error) {
      console.error('[WasmEngine] Failed to load FFmpeg:', error)
      throw new Error(`FFmpeg initialization failed: ${error instanceof Error ? error.message : String(error)}`)
    }
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
      normalizeOptions.autoRotate ? 'ar1' : 'ar0',
      normalizeOptions.autoRotateDirection,
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

  private _orientationFromDimensions(width: number, height: number): 'landscape' | 'portrait' | 'square' {
    if (width === height) return 'square'
    return width > height ? 'landscape' : 'portrait'
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
    const language = normalizeOptions.language

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
      onStage?.(tr(language, 'stageCleanTemp'))
      await this._cleanupTempFiles()

      // 1. Write and normalize each clip
      const normalizedNames: string[] = []
      const normalizedAudioNames: string[] = []
      for (let i = 0; i < clips.length; i++) {
        onStage?.(tr(language, 'stagePrepareClip', { current: i + 1, total: clips.length }))
        const clip = clips[i]
        const ext = clip.name.split('.').pop() ?? 'mp4'
        const inputName = `clip_${i}.${ext}`
        const outputName = this._getOrCreateCachedVideoName(this._getVideoCacheKey(clip, normalizeOptions))
        const { width, height, fps } = normalizeOptions

        if (!(await this._fileExists(outputName))) {
          onStage?.(tr(language, 'stageNormalizeVideo', { current: i + 1, total: clips.length }))
          await this.ffmpeg.writeFile(inputName, await fetchFile(clip))
          const sourceProbe = await this._probeName(inputName)
          const sourceOrientation = this._orientationFromDimensions(sourceProbe.width, sourceProbe.height)
          const targetOrientation = this._orientationFromDimensions(width, height)
          const shouldRotate = normalizeOptions.autoRotate
            && targetOrientation !== 'square'
            && sourceOrientation !== 'square'
            && sourceOrientation !== targetOrientation

          if (shouldRotate) {
            onStage?.(tr(language, 'stageAutoRotateClip', { current: i + 1, total: clips.length }))
          }

          const rotatePrefix = shouldRotate
            ? `transpose=${normalizeOptions.autoRotateDirection === 'ccw' ? '2' : '1'},`
            : ''
          const normalizeArgs = [
            '-y',
            '-i', inputName,
            '-map', '0:v:0',
            // Fill target frame and crop from center instead of letterboxing.
            '-vf', `${rotatePrefix}scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps},setsar=1`,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
            '-an',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            outputName,
          ]
          await this.ffmpeg.exec(normalizeArgs)
          await this._safeDelete(inputName)
        } else {
          onStage?.(tr(language, 'stageUseCachedVideo', { current: i + 1, total: clips.length }))
        }

        // Preserve original audio as a separate normalized stream to avoid hangs in combined AV transcode.
        if (!mixAudioOptions.replaceOriginalAudio) {
          const audioOutputName = this._getOrCreateCachedAudioName(this._getAudioCacheKey(clip))
          if (!(await this._fileExists(audioOutputName))) {
            onStage?.(tr(language, 'stageNormalizeOriginalAudio', { current: i + 1, total: clips.length }))
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
            onStage?.(tr(language, 'stageUseCachedOriginalAudio', { current: i + 1, total: clips.length }))
          }

          if (await this._fileExists(audioOutputName)) {
            normalizedAudioNames.push(audioOutputName)
          }
        }

        normalizedNames.push(outputName)
        advance()
      }

      // 2. Concat
      onStage?.(tr(language, 'stageConcatClips'))
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
        onStage?.(tr(language, 'stageConcatOriginalAudio'))
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
        onStage?.(tr(language, 'stageAddOriginalAudio'))
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
        onStage?.(mixAudioOptions.replaceOriginalAudio
          ? tr(language, 'stageAddMusicReplace')
          : tr(language, 'stageMixVoiceoverMusic'))
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
        onStage?.(tr(language, 'stageFinalizeNoMusic'))
      }

      try {
        onStage?.(tr(language, 'stageLoadOutput'))
        const data = await this.ffmpeg.readFile(finalOutput)
        await this._safeDelete(finalOutput)
        onStage?.(tr(language, 'stageDone'))
        return data as Uint8Array
      } catch {
        throw new Error(tr(language, 'errReadOutput', { file: finalOutput, tail: this._tailLogs(language, logs) }))
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      throw new Error(`${msg}. ${this._tailLogs(language, logs)}`)
    } finally {
      this.ffmpeg.off('log', logger)
    }
  }

  private async _probeName(name: string): Promise<{ duration: number; hasAudio: boolean; width: number; height: number }> {
    let output = ''
    const logger = ({ message }: { message: string }) => { output += message + '\n' }
    this.ffmpeg.on('log', logger)
    try { await this.ffmpeg.exec(['-i', name, '-f', 'null', '-']) } catch { /* expected */ }
    this.ffmpeg.off('log', logger)
    const videoMatch = output.match(/(\d{2,5})x(\d{2,5})/)
    return {
      duration: this._parseDuration(output),
      hasAudio: /Audio:\s/.test(output),
      width: parseInt(videoMatch?.[1] ?? '0', 10),
      height: parseInt(videoMatch?.[2] ?? '0', 10),
    }
  }

  private async _safeDelete(path: string): Promise<void> {
    try {
      await this.ffmpeg.deleteFile(path)
    } catch {
      // File may already be missing in ffmpeg FS; ignore cleanup errors.
    }
  }

  private _tailLogs(language: NormalizeOptions['language'], logs: string[]): string {
    if (logs.length === 0) return tr(language, 'ffmpegNoLogs')
    return tr(language, 'ffmpegLastLogs', { logs: logs.slice(-6).join(' | ') })
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
