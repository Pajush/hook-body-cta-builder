import { useEffect, useRef } from 'react'
import type { CombinationResult } from '../state/types'
import { useProjectStore } from '../state/projectStore'
import { tr } from '../i18n/dictionary'

interface Props {
  combo: CombinationResult | null
  onClose: () => void
}

export function PreviewModal({ combo, onClose }: Props) {
  const language = useProjectStore((s) => s.language)
  const videoRef = useRef<HTMLVideoElement>(null)
  const blobUrl = useRef<string | null>(null)

  useEffect(() => {
    if (combo?.outputBlob) {
      blobUrl.current = URL.createObjectURL(combo.outputBlob)
      if (videoRef.current) videoRef.current.src = blobUrl.current
    }
    return () => {
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
    }
  }, [combo])

  if (!combo) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">{combo.filename}</p>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none ml-3"
            aria-label={tr(language, 'close')}
          >
            ✕
          </button>
        </div>
        <video
          ref={videoRef}
          controls
          autoPlay
          className="w-full max-h-[70vh] bg-black"
        />
      </div>
    </div>
  )
}
