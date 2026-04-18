import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { IEngine, MixAudioOptions, NormalizeOptions, ProgressCallback, ProbeResult } from './EngineInterface'

const CORE_URL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm'

export class WasmEngine implements IEngine {
  private ffmpeg: FFmpeg
  private loaded = false

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
  }: {
    clips: File[]
    music: File | null
    normalizeOptions: NormalizeOptions
    mixAudioOptions: MixAudioOptions
    onProgress?: ProgressCallback
  }): Promise<Uint8Array> {
    await this.load()

    const totalSteps = clips.length + 2 // normalize each + concat + mix
    let step = 0
    const advance = () => { step++; onProgress?.(step / totalSteps) }

    // 1. Write and normalize each clip
    const normalizedNames: string[] = []
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      const ext = clip.name.split('.').pop() ?? 'mp4'
      const inputName = `clip_${i}.${ext}`
      const outputName = `norm_${i}.mp4`
      await this.ffmpeg.writeFile(inputName, await fetchFile(clip))
      const { width, height, fps } = normalizeOptions
      await this.ffmpeg.exec([
        '-i', inputName,
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps}`,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-c:a', mixAudioOptions.replaceOriginalAudio ? 'an' : 'aac',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outputName,
      ])
      await this.ffmpeg.deleteFile(inputName)
      normalizedNames.push(outputName)
      advance()
    }

    // 2. Concat
    const concatListContent = normalizedNames.map(n => `file '${n}'`).join('\n')
    await this.ffmpeg.writeFile('concat_list.txt', concatListContent)
    const concatOutput = 'concat_out.mp4'
    await this.ffmpeg.exec([
      '-f', 'concat', '-safe', '0',
      '-i', 'concat_list.txt',
      '-c', 'copy',
      concatOutput,
    ])
    for (const n of normalizedNames) await this.ffmpeg.deleteFile(n)
    await this.ffmpeg.deleteFile('concat_list.txt')
    advance()

    let finalOutput = concatOutput

    // 3. Mix audio
    if (music) {
      const musicExt = music.name.split('.').pop() ?? 'mp3'
      const musicName = `music.${musicExt}`
      await this.ffmpeg.writeFile(musicName, await fetchFile(music))

      const mixedOutput = 'mixed_out.mp4'

      // Get concat duration for fade-out timing
      const probe = await this._probeName(concatOutput)
      const duration = probe.duration

      const audioFilter = mixAudioOptions.fadeOut
        ? `afade=t=out:st=${Math.max(0, duration - mixAudioOptions.fadeOutDuration)}:d=${mixAudioOptions.fadeOutDuration}`
        : 'acopy'

      await this.ffmpeg.exec([
        '-i', concatOutput,
        '-stream_loop', '-1', '-i', musicName,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-vcodec', 'copy',
        '-acodec', 'aac',
        '-af', audioFilter,
        '-shortest',
        mixedOutput,
      ])

      await this.ffmpeg.deleteFile(concatOutput)
      await this.ffmpeg.deleteFile(musicName)
      finalOutput = mixedOutput
    }
    advance()

    const data = await this.ffmpeg.readFile(finalOutput)
    await this.ffmpeg.deleteFile(finalOutput)
    return data as Uint8Array
  }

  private async _probeName(name: string): Promise<{ duration: number }> {
    let output = ''
    const logger = ({ message }: { message: string }) => { output += message + '\n' }
    this.ffmpeg.on('log', logger)
    try { await this.ffmpeg.exec(['-i', name, '-f', 'null', '-']) } catch { /* expected */ }
    this.ffmpeg.off('log', logger)
    return { duration: this._parseDuration(output) }
  }
}
