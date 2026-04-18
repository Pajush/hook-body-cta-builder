import React, { useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ClipItem, ClipType } from '../state/types'
import { useProjectStore } from '../state/projectStore'

interface ClipRowProps {
  clip: ClipItem
  type: ClipType
}

function ClipRow({ clip, type }: ClipRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: clip.id })
  const removeClip = useProjectStore((s) => s.removeClip)
  const updateClipName = useProjectStore((s) => s.updateClipName)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-zinc-400 cursor-grab active:cursor-grabbing px-1 select-none"
        aria-label="Přetáhnout"
      >
        ⠿
      </button>

      {clip.thumbnailUrl && (
        <video
          src={clip.thumbnailUrl}
          className="w-14 h-10 object-cover rounded bg-zinc-100 dark:bg-zinc-900"
          muted
        />
      )}

      <input
        type="text"
        value={clip.name}
        onChange={(e) => updateClipName(type, clip.id, e.target.value)}
        className="flex-1 min-w-0 text-sm border border-zinc-200 dark:border-zinc-600 rounded px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-violet-500"
        aria-label="Název klipu"
      />

      {clip.duration !== undefined && (
        <span className="text-xs text-zinc-400 shrink-0">{clip.duration.toFixed(1)}s</span>
      )}

      <button
        onClick={() => removeClip(type, clip.id)}
        className="text-zinc-400 hover:text-red-500 shrink-0 transition-colors"
        aria-label="Odstranit"
      >
        ✕
      </button>
    </div>
  )
}

interface ClipBucketProps {
  type: ClipType
  label: string
  color: string
}

function getBaseFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
}

function getUniqueClipName(existingNames: string[], rawName: string): string {
  const normalized = rawName.trim() || 'clip'
  if (!existingNames.includes(normalized)) return normalized

  let suffix = 2
  let candidate = `${normalized}-${suffix}`
  while (existingNames.includes(candidate)) {
    suffix += 1
    candidate = `${normalized}-${suffix}`
  }
  return candidate
}

export function ClipBucket({ type, label, color }: ClipBucketProps) {
  const clips = useProjectStore((s) =>
    type === 'hook' ? s.hooks : type === 'body' ? s.bodies : s.ctas
  )
  const addClip = useProjectStore((s) => s.addClip)
  const reorderClips = useProjectStore((s) => s.reorderClips)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = clips.findIndex((c) => c.id === active.id)
      const newIndex = clips.findIndex((c) => c.id === over.id)
      reorderClips(type, arrayMove(clips, oldIndex, newIndex))
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const nextNames = clips.map((clip) => clip.name)
    for (const file of Array.from(files)) {
      const defaultName = getUniqueClipName(nextNames, getBaseFileName(file.name))
      nextNames.push(defaultName)
      const thumbnailUrl = URL.createObjectURL(file)
      const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`

      // Quick metadata probe via HTML5 video element
      const metadata = await new Promise<{ duration: number; width: number; height: number }>((resolve) => {
        const v = document.createElement('video')
        v.preload = 'metadata'
        v.src = thumbnailUrl
        v.onloadedmetadata = () => {
          resolve({
            duration: Number.isFinite(v.duration) ? v.duration : 0,
            width: v.videoWidth || 0,
            height: v.videoHeight || 0,
          })
        }
        v.onerror = () => resolve({ duration: 0, width: 0, height: 0 })
      })

      addClip(type, {
        id,
        file,
        name: defaultName,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        thumbnailUrl,
      })
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center gap-2 mb-1`}>
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{label}</h2>
        <span className="ml-auto text-xs text-zinc-400">{clips.length} klipy</span>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-center text-sm text-zinc-400 hover:border-violet-400 hover:text-violet-500 cursor-pointer transition-colors"
      >
        Přetáhni nebo klikni pro přidání videí
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={clips.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {clips.map((clip) => (
              <ClipRow key={clip.id} clip={clip} type={type} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
