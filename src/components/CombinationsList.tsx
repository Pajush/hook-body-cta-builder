import { useProjectStore } from '../state/projectStore'
import { getEngine } from '../lib/engineSingleton'
import { downloadAsZip, downloadSingle } from '../lib/zip'
import { tr } from '../i18n/dictionary'
import type { CombinationResult } from '../state/types'

interface Props {
  onPreview: (combo: CombinationResult) => void
}

type Orientation = 'landscape' | 'portrait' | 'square'

function getOrientation(width: number, height: number): Orientation {
  if (width === height) return 'square'
  return width > height ? 'landscape' : 'portrait'
}

async function readClipDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = url

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({ width: video.videoWidth || 0, height: video.videoHeight || 0 })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
  })
}

async function validateClipOrientation(
  combo: CombinationResult,
  targetWidth: number,
  targetHeight: number,
  autoRotate: boolean,
  language: 'cs' | 'en',
): Promise<string | null> {
  const targetOrientation = getOrientation(targetWidth, targetHeight)
  if (autoRotate) return null
  if (targetOrientation === 'square') return null

  for (const clip of combo.clips) {
    let width = clip.width ?? 0
    let height = clip.height ?? 0

    if (!width || !height) {
      const dim = await readClipDimensions(clip.file)
      width = dim?.width ?? 0
      height = dim?.height ?? 0
    }

    if (!width || !height) continue
    if (getOrientation(width, height) !== targetOrientation) {
      const requiredLabel = targetOrientation === 'landscape'
        ? tr(language, 'outputHorizontal')
        : tr(language, 'outputVertical')
      return tr(language, 'orientationError', { name: clip.name, required: requiredLabel })
    }
  }

  return null
}

function resolveAutoFpsCandidate(fps: number): number {
  if (!Number.isFinite(fps) || fps <= 0) return 30
  return Math.max(12, Math.min(120, Math.round(fps)))
}

function statusLabel(status: CombinationResult['status'], language: 'cs' | 'en'): string {
  switch (status) {
    case 'idle': return tr(language, 'statusIdle')
    case 'rendering': return tr(language, 'statusRendering')
    case 'done': return tr(language, 'statusDone')
    case 'error': return tr(language, 'statusError')
  }
}

function statusColor(status: CombinationResult['status']): string {
  switch (status) {
    case 'idle': return 'text-zinc-400'
    case 'rendering': return 'text-violet-500'
    case 'done': return 'text-green-500'
    case 'error': return 'text-red-500'
  }
}

export function CombinationsList({ onPreview }: Props) {
  const combinations = useProjectStore((s) => s.combinations)
  const language = useProjectStore((s) => s.language)
  const updateCombination = useProjectStore((s) => s.updateCombination)
  const music = useProjectStore((s) => s.music)
  const normalizeSettings = useProjectStore((s) => s.normalizeSettings)
  const audioSettings = useProjectStore((s) => s.audioSettings)
  const engineLoaded = useProjectStore((s) => s.engineLoaded)
  const setEngineLoaded = useProjectStore((s) => s.setEngineLoaded)
  const setEngineLoading = useProjectStore((s) => s.setEngineLoading)
  const engineLoading = useProjectStore((s) => s.engineLoading)

  async function ensureEngine() {
    if (!engineLoaded) {
      setEngineLoading(true)
      try {
        // Add a timeout to prevent infinite hang
        const loadPromise = getEngine().load()
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('FFmpeg initialization timeout (>60s)')), 60000)
        )
        await Promise.race([loadPromise, timeoutPromise])
        setEngineLoaded(true)
      } catch (error) {
        setEngineLoading(false)
        throw error
      }
      setEngineLoading(false)
    }
  }

  async function renderCombo(combo: CombinationResult) {
    const orientationError = await validateClipOrientation(
      combo,
      normalizeSettings.width,
      normalizeSettings.height,
      normalizeSettings.autoRotate,
      language,
    )
    if (orientationError) {
      updateCombination(combo.id, {
        status: 'error',
        progress: 0,
        outputBlob: undefined,
        errorMessage: orientationError,
        debugMessage: tr(language, 'orientationInvalidDebug'),
      })
      return
    }

    updateCombination(combo.id, {
      status: 'rendering',
      progress: 0,
      outputBlob: undefined,
      errorMessage: undefined,
      debugMessage: tr(language, 'preparingRender'),
    })
    try {
      await ensureEngine()
      let effectiveFps = normalizeSettings.fps
      if (normalizeSettings.fps === 0) {
        updateCombination(combo.id, { debugMessage: tr(language, 'detectFps') })
        const probeFpsValues: number[] = []
        for (const clip of combo.clips) {
          try {
            const probe = await getEngine().probe(clip.file)
            if (Number.isFinite(probe.fps) && probe.fps > 0) {
              probeFpsValues.push(probe.fps)
            }
          } catch {
            // Ignore failed probe and continue with remaining clips.
          }
        }
        const average = probeFpsValues.length
          ? probeFpsValues.reduce((sum, value) => sum + value, 0) / probeFpsValues.length
          : 30
        effectiveFps = resolveAutoFpsCandidate(average)
        updateCombination(combo.id, { debugMessage: tr(language, 'autoFpsSelected', { fps: effectiveFps }) })
      }

      const data = await getEngine().buildCombination({
        clips: combo.clips.map((clip) => clip.file),
        music: music ?? null,
        normalizeOptions: {
          ...normalizeSettings,
          fps: effectiveFps,
          language,
        },
        mixAudioOptions: audioSettings,
        onProgress: (p) => updateCombination(combo.id, { progress: p }),
        onStage: (message) => updateCombination(combo.id, { debugMessage: message }),
      })
      const arrayBuffer = Uint8Array.from(data).buffer
      const blob = new Blob([arrayBuffer], { type: 'video/mp4' })
      updateCombination(combo.id, {
        status: 'done',
        progress: 1,
        outputBlob: blob,
        debugMessage: tr(language, 'renderCompleted'),
      })
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      console.error('[CombinationsList] Render error:', errorMsg)
      
      let userErrorMsg = errorMsg
      let debugMsg = tr(language, 'renderFailed')
      
      if (errorMsg.includes('timeout')) {
        userErrorMsg = tr(language, 'ffmpegTimeout')
        debugMsg = tr(language, 'ffmpegTimeout')
      } else if (errorMsg.includes('network') || errorMsg.includes('Failed to fetch')) {
        userErrorMsg = tr(language, 'ffmpegNetworkError')
        debugMsg = tr(language, 'ffmpegNetworkError')
      } else if (errorMsg.includes('SharedArrayBuffer') || errorMsg.includes('initialization')) {
        userErrorMsg = tr(language, 'ffmpegInitError')
        debugMsg = tr(language, 'ffmpegInitError')
      }
      
      updateCombination(combo.id, {
        status: 'error',
        errorMessage: userErrorMsg,
        debugMessage: debugMsg,
      })
    }
  }

  async function renderAll() {
    for (const combo of combinations) {
      if (combo.status === 'idle' || combo.status === 'error') {
        await renderCombo(combo)
      }
    }
  }

  if (combinations.length === 0) return null

  const doneCount = combinations.filter((c) => c.status === 'done').length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
          {tr(language, 'combinationsTitle')} ({combinations.length})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={renderAll}
            disabled={engineLoading}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
          >
            {engineLoading ? tr(language, 'loadingEngine') : tr(language, 'renderAll')}
          </button>
        </div>
      </div>

      {engineLoading && (
        <p className="text-sm text-violet-500 animate-pulse">
          {tr(language, 'ffmpegLoading')}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {combinations.map((combo) => (
          <div
            key={combo.id}
            className="flex items-center gap-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">
                {combo.filename}
              </p>
              <p className="text-xs text-zinc-400">
                {[combo.hook?.name, combo.body?.name, combo.cta?.name].filter(Boolean).join(' + ')}
              </p>
              {combo.status === 'rendering' && (
                <div className="mt-1 h-1 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 transition-all duration-300"
                    style={{ width: `${Math.round(combo.progress * 100)}%` }}
                  />
                </div>
              )}
              {(combo.status === 'rendering' || combo.status === 'error') && combo.debugMessage && (
                <p className="text-xs text-zinc-500 mt-0.5">{combo.debugMessage}</p>
              )}
              {combo.status === 'error' && (
                <p className="text-xs text-red-400 mt-0.5">{combo.errorMessage}</p>
              )}
            </div>

            <span className={`text-xs font-medium shrink-0 ${statusColor(combo.status)}`}>
              {statusLabel(combo.status, language)}
            </span>

            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => renderCombo(combo)}
                disabled={combo.status === 'rendering' || engineLoading}
                className="px-3 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-700 hover:bg-violet-100 dark:hover:bg-zinc-600 disabled:opacity-40 rounded-lg transition-colors"
              >
                {tr(language, 'renderButton')}
              </button>

              {combo.status === 'done' && (
                <>
                  <button
                    onClick={() => onPreview(combo)}
                    className="px-3 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-700 hover:bg-blue-100 dark:hover:bg-zinc-600 rounded-lg transition-colors"
                  >
                    {tr(language, 'previewButton')}
                  </button>
                  <button
                    onClick={() => downloadSingle(combo)}
                    className="px-3 py-1.5 text-xs bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-800/40 text-green-700 dark:text-green-400 rounded-lg transition-colors font-medium"
                  >
                    {tr(language, 'downloadButton')}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {doneCount > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => downloadAsZip(combinations)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors font-medium"
          >
            {tr(language, 'downloadAllZip', { count: doneCount })}
          </button>
        </div>
      )}
    </div>
  )
}
