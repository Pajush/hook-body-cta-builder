import { useProjectStore } from '../state/projectStore'
import { FPS_PRESETS, RESOLUTION_PRESETS, tr } from '../i18n/dictionary'

function fpsDescription(fps: number, isCs: boolean): string {
  const language = isCs ? 'cs' : 'en'
  if (fps === 0) return tr(language, 'fpsDescAuto')
  if (fps === 60) return tr(language, 'fpsDesc60')
  if (fps === 30) return tr(language, 'fpsDesc30')
  return tr(language, 'fpsDescGeneric', { fps })
}

export function SettingsPanel() {
  const language = useProjectStore((s) => s.language)
  const projectName = useProjectStore((s) => s.projectName)
  const setProjectName = useProjectStore((s) => s.setProjectName)
  const norm = useProjectStore((s) => s.normalizeSettings)
  const setNorm = useProjectStore((s) => s.setNormalizeSettings)
  const isCs = language === 'cs'

  const currentResKey = `${norm.width}x${norm.height}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{tr(language, 'settingsTitle')}</h2>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{tr(language, 'projectName')}</label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="border border-zinc-200 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
          placeholder="video"
        />
        <p className="text-xs text-zinc-400">{tr(language, 'outputFiles')}: {projectName || 'video'}-hook1-body1-cta1.mp4</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{tr(language, 'outputResolution')}</label>
        <select
          value={currentResKey}
          onChange={(e) => {
            const [w, h] = e.target.value.split('x').map(Number)
            setNorm({ width: w, height: h })
          }}
          className="border border-zinc-200 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          {RESOLUTION_PRESETS[isCs ? 'cs' : 'en'].map((r) => (
            <option key={`${r.width}x${r.height}`} value={`${r.width}x${r.height}`}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{tr(language, 'outputFps')}</label>
        <select
          value={norm.fps}
          onChange={(e) => setNorm({ fps: parseInt(e.target.value, 10) })}
          className="border border-zinc-200 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          {FPS_PRESETS[isCs ? 'cs' : 'en'].map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <p className="text-xs text-zinc-400">{fpsDescription(norm.fps, isCs)}</p>
      </div>

      <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={norm.autoRotate}
          onChange={(e) => setNorm({ autoRotate: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          {tr(language, 'autoRotateMismatch')}
          <span className="block text-xs text-zinc-400">
            {tr(language, 'autoRotateHelp')}
          </span>
        </span>
      </label>

      {norm.autoRotate && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{tr(language, 'autoRotateDirection')}</label>
            <span className="relative inline-flex group">
              <button
                type="button"
                aria-label={tr(language, 'rotationDirectionHelpLabel')}
                className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-600 text-[10px] leading-none text-zinc-500 dark:text-zinc-300 flex items-center justify-center"
              >
                ?
              </button>
              <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-56 -translate-x-1/2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[11px] leading-snug text-zinc-600 dark:text-zinc-300 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {tr(language, 'rotationDirectionHelp')}
              </span>
            </span>
          </div>
          <select
            value={norm.autoRotateDirection}
            onChange={(e) => setNorm({ autoRotateDirection: e.target.value as 'cw' | 'ccw' })}
            className="border border-zinc-200 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="cw">{tr(language, 'rotateRight')}</option>
            <option value="ccw">{tr(language, 'rotateLeft')}</option>
          </select>
          <p className="text-xs text-zinc-400">{tr(language, 'autoRotateDirectionNote')}</p>
        </div>
      )}

    </div>
  )
}
