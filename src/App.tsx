import { useState } from 'react'
import { ClipBucket } from './components/ClipBucket'
import { MusicPanel } from './components/MusicPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { CombinationsList } from './components/CombinationsList'
import { PreviewModal } from './components/PreviewModal'
import { useProjectStore } from './state/projectStore'
import type { CombinationResult } from './state/types'

export default function App() {
  const [previewCombo, setPreviewCombo] = useState<CombinationResult | null>(null)
  const generateCombinations = useProjectStore((s) => s.generateCombinations)
  const hooks = useProjectStore((s) => s.hooks)
  const bodies = useProjectStore((s) => s.bodies)
  const ctas = useProjectStore((s) => s.ctas)
  const hasCombinations = useProjectStore((s) => s.combinations.length > 0)

  const canGenerate = hooks.length > 0 && bodies.length > 0 && ctas.length > 0

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <span className="text-xl">🎬</span>
          <h1 className="text-lg font-bold tracking-tight">Video Combinator</h1>
          <span className="ml-auto text-xs text-zinc-400 hidden sm:block">
            Hook × Body × CTA — vše v prohlížeči
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <ClipBucket type="hook" label="Hooky" color="bg-violet-500" />
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <ClipBucket type="body" label="Body" color="bg-blue-500" />
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <ClipBucket type="cta" label="CTA" color="bg-orange-500" />
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <MusicPanel />
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <SettingsPanel />
          </div>
        </section>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={generateCombinations}
            disabled={!canGenerate}
            className="px-8 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base rounded-xl transition-colors shadow-md"
          >
            ✨ Vygenerovat kombinace{canGenerate ? ` (${hooks.length * bodies.length * ctas.length})` : ''}
          </button>
          {!canGenerate && (
            <p className="text-sm text-zinc-400">
              Přidej alespoň 1 hook, 1 body a 1 CTA klip.
            </p>
          )}
        </div>

        {hasCombinations && (
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <CombinationsList onPreview={setPreviewCombo} />
          </section>
        )}
      </main>

      <PreviewModal combo={previewCombo} onClose={() => setPreviewCombo(null)} />
    </div>
  )
}
