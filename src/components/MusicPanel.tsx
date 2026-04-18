import { useRef } from 'react'
import { useProjectStore } from '../state/projectStore'

export function MusicPanel() {
  const music = useProjectStore((s) => s.music)
  const setMusic = useProjectStore((s) => s.setMusic)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(files: FileList | null) {
    if (files?.[0]) setMusic(files[0])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Hudba</h2>
      </div>

      {music ? (
        <div className="flex items-center gap-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3">
          <span className="text-2xl">🎵</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">{music.name}</p>
            <p className="text-xs text-zinc-400">{(music.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
          <button
            onClick={() => setMusic(null)}
            className="text-zinc-400 hover:text-red-500 transition-colors"
            aria-label="Odebrat hudbu"
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
          Přetáhni nebo klikni pro výběr hudby (MP3, AAC, WAV)
        </div>
      )}

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
