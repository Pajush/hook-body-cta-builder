import { useProjectStore } from '../state/projectStore'

const RESOLUTIONS = [
  { label: '1080×1920 (vertikál, TikTok/Reels)', width: 1080, height: 1920 },
  { label: '1920×1080 (horizontál, YouTube)', width: 1920, height: 1080 },
  { label: '1080×1080 (čtverec)', width: 1080, height: 1080 },
]

export function SettingsPanel() {
  const projectName = useProjectStore((s) => s.projectName)
  const setProjectName = useProjectStore((s) => s.setProjectName)
  const norm = useProjectStore((s) => s.normalizeSettings)
  const setNorm = useProjectStore((s) => s.setNormalizeSettings)
  const audio = useProjectStore((s) => s.audioSettings)
  const setAudio = useProjectStore((s) => s.setAudioSettings)

  const currentResKey = `${norm.width}x${norm.height}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Nastavení</h2>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Název projektu</label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="border border-zinc-200 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
          placeholder="video"
        />
        <p className="text-xs text-zinc-400">Výsledné soubory: {projectName || 'video'}-hook1-body1-cta1.mp4</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Výstupní rozlišení</label>
        <select
          value={currentResKey}
          onChange={(e) => {
            const [w, h] = e.target.value.split('x').map(Number)
            setNorm({ width: w, height: h })
          }}
          className="border border-zinc-200 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          {RESOLUTIONS.map((r) => (
            <option key={`${r.width}x${r.height}`} value={`${r.width}x${r.height}`}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">FPS výstupu</label>
        <select
          value={norm.fps}
          onChange={(e) => setNorm({ fps: parseInt(e.target.value) })}
          className="border border-zinc-200 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          {[24, 25, 30, 60].map((f) => (
            <option key={f} value={f}>{f} fps</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-700">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Audio</label>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={audio.replaceOriginalAudio}
            onChange={(e) => setAudio({ replaceOriginalAudio: e.target.checked })}
            className="accent-violet-500"
          />
          Nahradit originální audio hudební stopou
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={audio.fadeOut}
            onChange={(e) => setAudio({ fadeOut: e.target.checked })}
            className="accent-violet-500"
          />
          Fade-out hudby na konci
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
    </div>
  )
}
