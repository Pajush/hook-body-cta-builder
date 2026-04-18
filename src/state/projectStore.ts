import { create } from 'zustand'
import type { ClipItem, ProjectStore } from './types'
import { generateCombinations as computeCombinations } from '../lib/combinations'

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projectName: 'video',
  hooks: [],
  bodies: [],
  ctas: [],
  music: null,
  normalizeSettings: { width: 1080, height: 1920, fps: 30 },
  audioSettings: { fadeOut: true, fadeOutDuration: 1, replaceOriginalAudio: false, musicVolume: 0.8 },
  combinations: [],
  engineLoaded: false,
  engineLoading: false,

  setProjectName: (name) => set({ projectName: name }),

  addClip: (type, clip) => {
    const key = type === 'hook' ? 'hooks' : type === 'body' ? 'bodies' : 'ctas'
    set((s) => ({ [key]: [...s[key], clip] }))
  },

  removeClip: (type, id) => {
    const key = type === 'hook' ? 'hooks' : type === 'body' ? 'bodies' : 'ctas'
    set((s) => ({ [key]: s[key].filter((c: ClipItem) => c.id !== id) }))
  },

  updateClipName: (type, id, name) => {
    const key = type === 'hook' ? 'hooks' : type === 'body' ? 'bodies' : 'ctas'
    set((s) => ({
      [key]: s[key].map((c: ClipItem) => c.id === id ? { ...c, name } : c),
    }))
  },

  reorderClips: (type, clips) => {
    const key = type === 'hook' ? 'hooks' : type === 'body' ? 'bodies' : 'ctas'
    set({ [key]: clips })
  },

  setMusic: (file) => set({ music: file }),

  setNormalizeSettings: (s) =>
    set((prev) => ({ normalizeSettings: { ...prev.normalizeSettings, ...s } })),

  setAudioSettings: (s) =>
    set((prev) => ({ audioSettings: { ...prev.audioSettings, ...s } })),

  generateCombinations: () => {
    const { hooks, bodies, ctas, projectName } = get()
    const combos = computeCombinations(hooks, bodies, ctas, projectName)
    set({ combinations: combos })
  },

  updateCombination: (id, patch) =>
    set((s) => ({
      combinations: s.combinations.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
    })),

  setEngineLoaded: (v) => set({ engineLoaded: v }),
  setEngineLoading: (v) => set({ engineLoading: v }),
}))
