import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { tr } from '../i18n/dictionary'

export function MusicPanel() {
  const language = useProjectStore((s) => s.language)
  const music = useProjectStore((s) => s.music)
  const setMusic = useProjectStore((s) => s.setMusic)
  const audio = useProjectStore((s) => s.audioSettings)
  const setAudio = useProjectStore((s) => s.setAudioSettings)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioPreviewRef = useRef<HTMLAudioElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (!music) {
      setPreviewUrl(null)
      setIsPlaying(false)
      return
    }

    const url = URL.createObjectURL(music)
    setPreviewUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [music])

  useEffect(() => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.volume = Math.max(0, Math.min(1, audio.musicVolume / 2))
    }
  }, [audio.musicVolume])

  function handleFile(files: FileList | null) {
    if (files?.[0]) setMusic(files[0])
  }

  async function togglePlayback() {
    const element = audioPreviewRef.current
    if (!element || !previewUrl) return

    if (element.paused) {
      try {
        await element.play()
        setIsPlaying(true)
      } catch {
        setIsPlaying(false)
      }
      return
    }

    element.pause()
    setIsPlaying(false)
  }

  function removeMusic() {
    audioPreviewRef.current?.pause()
    setIsPlaying(false)
    setMusic(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{tr(language, 'musicTitle')}</h2>
      </div>

      {music ? (
        <div className="flex items-center gap-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3">
          <span className="text-2xl">🎵</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">{music.name}</p>
            <p className="text-xs text-zinc-400">{(music.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
          <button
            onClick={removeMusic}
            className="text-zinc-400 hover:text-red-500 transition-colors"
            aria-label={tr(language, 'removeMusic')}
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files) }}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-center text-sm text-zinc-400 hover:border-green-400 hover:text-green-500 cursor-pointer transition-colors"
        >
          {tr(language, 'musicDropzone')}
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="text-sm text-zinc-700 dark:text-zinc-300 min-w-24">{tr(language, 'musicVolume')}</label>
        <button
          type="button"
          onClick={togglePlayback}
          disabled={!previewUrl}
          className="shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          {isPlaying ? tr(language, 'pause') : tr(language, 'play')}
        </button>
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={audio.musicVolume}
          onChange={(e) => setAudio({ musicVolume: parseFloat(e.target.value) })}
          className="flex-1 accent-violet-500"
        />
        <span className="text-xs text-zinc-500 w-12 text-right">
          {Math.round(audio.musicVolume * 100)}%
        </span>
      </div>

      <audio
        ref={audioPreviewRef}
        src={previewUrl ?? undefined}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        className="hidden"
      />

      <div className="flex flex-col gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-700">
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={audio.replaceOriginalAudio}
            onChange={(e) => setAudio({ replaceOriginalAudio: e.target.checked })}
            className="accent-violet-500"
          />
          {tr(language, 'replaceOriginalAudio')}
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={audio.fadeOut}
            onChange={(e) => setAudio({ fadeOut: e.target.checked })}
            className="accent-violet-500"
          />
          {tr(language, 'fadeOutMusic')}
        </label>

        {audio.fadeOut && (
          <div className="flex items-center gap-2 pl-5">
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.5}
              value={audio.fadeOutDuration}
              onChange={(e) => setAudio({ fadeOutDuration: parseFloat(e.target.value) })}
              className="flex-1 accent-violet-500"
            />
            <span className="text-xs text-zinc-500 w-10">{audio.fadeOutDuration}s</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />
    </div>
  )
}
