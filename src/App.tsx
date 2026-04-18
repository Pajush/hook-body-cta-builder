import { useRef, useState } from 'react'
import { ClipBucket } from './components/ClipBucket'
import { MusicPanel } from './components/MusicPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { CombinationsList } from './components/CombinationsList'
import { PreviewModal } from './components/PreviewModal'
import { useProjectStore } from './state/projectStore'
import { tr } from './i18n/dictionary'
import type { CombinationResult } from './state/types'

export default function App() {
  const [previewCombo, setPreviewCombo] = useState<CombinationResult | null>(null)
  const combinationsSectionRef = useRef<HTMLElement | null>(null)
  const language = useProjectStore((s) => s.language)
  const setLanguage = useProjectStore((s) => s.setLanguage)
  const generateCombinations = useProjectStore((s) => s.generateCombinations)
  const hooks = useProjectStore((s) => s.hooks)
  const bodies = useProjectStore((s) => s.bodies)
  const ctas = useProjectStore((s) => s.ctas)
  const hasCombinations = useProjectStore((s) => s.combinations.length > 0)

  const nonEmptyBuckets = [hooks.length, bodies.length, ctas.length].filter((count) => count > 0)
  const canGenerate = nonEmptyBuckets.length >= 2
  const expectedCombinations = canGenerate ? nonEmptyBuckets.reduce((acc, count) => acc * count, 1) : 0

  function handleGenerateCombinations() {
    generateCombinations()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        combinationsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <span className="text-xl">🎬</span>
          <h1 className="text-lg font-bold tracking-tight">{tr(language, 'appTitle')}</h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 p-1">
              <button
                type="button"
                onClick={() => setLanguage('cs')}
                className={`px-2 py-1 text-xs rounded ${language === 'cs' ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
              >
                {tr(language, 'languageCs')}
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 text-xs rounded ${language === 'en' ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
              >
                {tr(language, 'languageEn')}
              </button>
            </div>
            <a
              href="https://github.com/Pajush/hook-body-cta-builder"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
              title="GitHub"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
            <a
              href="https://buymeacoffee.com/pajushinkad"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors flex items-center gap-1"
              title="Buy me a coffee"
            >
              ☕
            </a>
          </div>
          <span className="text-xs text-zinc-400 hidden sm:block">
            {tr(language, 'appTagline')}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
        <section className="bg-gradient-to-r from-violet-50 to-blue-50 dark:from-zinc-900 dark:to-zinc-900 border border-violet-100 dark:border-zinc-800 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{tr(language, 'appInfoTitle')}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2">{tr(language, 'appInfoBrowserOnly')}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">{tr(language, 'appInfoRecommendedLoad')}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">{tr(language, 'appInfoMemory')}</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <ClipBucket type="hook" label={tr(language, 'bucketHooks')} color="bg-violet-500" />
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <ClipBucket type="body" label={tr(language, 'bucketBody')} color="bg-blue-500" />
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <ClipBucket type="cta" label={tr(language, 'bucketCta')} color="bg-orange-500" />
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
            onClick={handleGenerateCombinations}
            disabled={!canGenerate}
            className="px-8 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base rounded-xl transition-colors shadow-md"
          >
            {tr(language, 'generateCombinations')}{canGenerate ? ` (${expectedCombinations})` : ''}
          </button>
          {!canGenerate && (
            <p className="text-sm text-zinc-400">
              {tr(language, 'addTwoSections')}
            </p>
          )}
        </div>

        {hasCombinations && (
          <section ref={combinationsSectionRef} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <CombinationsList onPreview={setPreviewCombo} />
          </section>
        )}
      </main>

      <PreviewModal combo={previewCombo} onClose={() => setPreviewCombo(null)} />
    </div>
  )
}
