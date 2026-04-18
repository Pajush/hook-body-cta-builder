import type { ClipItem, CombinationResult } from '../state/types'

export function generateCombinations(
  hooks: ClipItem[],
  bodies: ClipItem[],
  ctas: ClipItem[],
  projectName: string
): CombinationResult[] {
  const results: CombinationResult[] = []
  for (const hook of hooks) {
    for (const body of bodies) {
      for (const cta of ctas) {
        const id = `${hook.id}_${body.id}_${cta.id}`
        const filename = `${projectName}-${hook.name}-${body.name}-${cta.name}.mp4`
        results.push({
          id,
          hook,
          body,
          cta,
          filename,
          status: 'idle',
          progress: 0,
        })
      }
    }
  }
  return results
}
