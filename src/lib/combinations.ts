import type { ClipItem, CombinationResult } from '../state/types'

function buildFilename(projectName: string, parts: string[]): string {
  return `${projectName}-${parts.join('-')}.mp4`
}

function buildId(parts: string[]): string {
  return parts.join('_')
}

export function generateCombinations(
  hooks: ClipItem[],
  bodies: ClipItem[],
  ctas: ClipItem[],
  projectName: string
): CombinationResult[] {
  const results: CombinationResult[] = []

  const activeGroups = [hooks.length > 0, bodies.length > 0, ctas.length > 0].filter(Boolean).length
  if (activeGroups < 2) return results

  if (hooks.length > 0 && bodies.length > 0 && ctas.length > 0) {
    for (const hook of hooks) {
      for (const body of bodies) {
        for (const cta of ctas) {
          results.push({
            id: buildId([hook.id, body.id, cta.id]),
            clips: [hook, body, cta],
            hook,
            body,
            cta,
            filename: buildFilename(projectName, [hook.name, body.name, cta.name]),
            status: 'idle',
            progress: 0,
          })
        }
      }
    }
    return results
  }

  if (hooks.length > 0 && bodies.length > 0) {
    for (const hook of hooks) {
      for (const body of bodies) {
        results.push({
          id: buildId([hook.id, body.id]),
          clips: [hook, body],
          hook,
          body,
          filename: buildFilename(projectName, [hook.name, body.name]),
          status: 'idle',
          progress: 0,
        })
      }
    }
  }

  if (hooks.length > 0 && ctas.length > 0) {
    for (const hook of hooks) {
      for (const cta of ctas) {
        results.push({
          id: buildId([hook.id, cta.id]),
          clips: [hook, cta],
          hook,
          cta,
          filename: buildFilename(projectName, [hook.name, cta.name]),
          status: 'idle',
          progress: 0,
        })
      }
    }
  }

  if (bodies.length > 0 && ctas.length > 0) {
    for (const body of bodies) {
      for (const cta of ctas) {
        results.push({
          id: buildId([body.id, cta.id]),
          clips: [body, cta],
          body,
          cta,
          filename: buildFilename(projectName, [body.name, cta.name]),
          status: 'idle',
          progress: 0,
        })
      }
    }
  }

  return results
}
