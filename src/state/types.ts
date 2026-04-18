export interface ClipItem {
  id: string
  file: File
  name: string // user-defined or default (hook1, body1, ...)
  duration?: number
  width?: number
  height?: number
  thumbnailUrl?: string
}

export type ClipType = 'hook' | 'body' | 'cta'

export interface CombinationResult {
  id: string
  clips: ClipItem[]
  hook?: ClipItem
  body?: ClipItem
  cta?: ClipItem
  filename: string
  status: 'idle' | 'rendering' | 'done' | 'error'
  progress: number // 0..1
  outputBlob?: Blob
  errorMessage?: string
  debugMessage?: string
}

export interface NormalizeSettings {
  width: number
  height: number
  fps: number // 0 = auto from source clips
  autoRotate: boolean
  autoRotateDirection: 'cw' | 'ccw'
}

export interface AudioSettings {
  fadeOut: boolean
  fadeOutDuration: number
  replaceOriginalAudio: boolean
  musicVolume: number // 0..2 where 1 is original level
}

export interface ProjectStore {
  projectName: string
  hooks: ClipItem[]
  bodies: ClipItem[]
  ctas: ClipItem[]
  music: File | null
  normalizeSettings: NormalizeSettings
  audioSettings: AudioSettings
  combinations: CombinationResult[]
  engineLoaded: boolean
  engineLoading: boolean

  setProjectName(name: string): void
  addClip(type: ClipType, clip: ClipItem): void
  removeClip(type: ClipType, id: string): void
  updateClipName(type: ClipType, id: string, name: string): void
  reorderClips(type: ClipType, clips: ClipItem[]): void
  setMusic(file: File | null): void
  setNormalizeSettings(s: Partial<NormalizeSettings>): void
  setAudioSettings(s: Partial<AudioSettings>): void
  generateCombinations(): void
  updateCombination(id: string, patch: Partial<CombinationResult>): void
  setEngineLoaded(v: boolean): void
  setEngineLoading(v: boolean): void
}
