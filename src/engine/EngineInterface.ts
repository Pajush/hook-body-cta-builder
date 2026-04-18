export interface ProbeResult {
  duration: number // seconds
  width: number
  height: number
  fps: number
}

export interface NormalizeOptions {
  width: number
  height: number
  fps: number
}

export interface MixAudioOptions {
  fadeOut: boolean
  fadeOutDuration: number // seconds
  replaceOriginalAudio: boolean
}

export type ProgressCallback = (progress: number) => void // 0..1

export interface IEngine {
  load(): Promise<void>
  probe(file: File): Promise<ProbeResult>
  buildCombination(params: {
    clips: File[]
    music: File | null
    normalizeOptions: NormalizeOptions
    mixAudioOptions: MixAudioOptions
    onProgress?: ProgressCallback
  }): Promise<Uint8Array>
}
