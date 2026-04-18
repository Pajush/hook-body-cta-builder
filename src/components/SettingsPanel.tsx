import { useProjectStore } from '../state/projectStore'

const RESOLUTIONS = [
  { label: '1080×1920 (vertikál, TikTok/Reels)', width: 1080, height: 1920 },
  { label: '1920×1080 (horizontál, YouTube)', width: 1920, height: 1080 },
  { label: '1080×1080 (čtverec)', width: 1080, height: 1080 },
]

const FPS_OPTIONS = [
  { value: 0, label: 'Auto (podle vstupních videí)' },
  { value: 24, label: '24 fps (filmový vzhled)' },
  { value: 25, label: '25 fps (PAL / EU)' },
  { value: 30, label: '30 fps (běžný web/social)' },
  { value: 60, label: '60 fps (plynulejší pohyb)' },
]

function fpsDescription(fps: number): string {
  if (fps === 0) return 'Auto použije FPS z přiložených klipů (zaokrouhlené na celé FPS). Když se nedá spolehlivě zjistit, použije se 30 fps.'
  if (fps === 60) return '60 fps NEzrychlí video 2x. Zachová stejnou délku, jen přidá plynulost. U zdrojů s 30 fps se dopočítají mezisnímky/duplikáty.'
  if (fps === 30) return '30 fps je bezpečný default pro většinu sociálních sítí a webu.'
  return `${fps} fps změní snímkování výstupu, ne délku videa.`
}

export function SettingsPanel() {
  const projectName = useProjectStore((s) => s.projectName)
  const setProjectName = useProjectStore((s) => s.setProjectName)
  const norm = useProjectStore((s) => s.normalizeSettings)
  const setNorm = useProjectStore((s) => s.setNormalizeSettings)

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
          onChange={(e) => setNorm({ fps: parseInt(e.target.value, 10) })}
          className="border border-zinc-200 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
        >
          {FPS_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <p className="text-xs text-zinc-400">{fpsDescription(norm.fps)}</p>
      </div>

      <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={norm.autoRotate}
          onChange={(e) => setNorm({ autoRotate: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          Auto-rotate při nesouladu orientace
          <span className="block text-xs text-zinc-400">
            Když je výstup horizontální a klip vertikální (nebo naopak), klip se zkusí otočit o 90° místo chyby.
          </span>
        </span>
      </label>

    </div>
  )
}
