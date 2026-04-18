import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { CombinationResult } from '../state/types'

export async function downloadAsZip(combinations: CombinationResult[]): Promise<void> {
  const zip = new JSZip()
  for (const combo of combinations) {
    if (combo.outputBlob) {
      zip.file(combo.filename, combo.outputBlob)
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, 'combinations.zip')
}

export function downloadSingle(combo: CombinationResult): void {
  if (combo.outputBlob) {
    saveAs(combo.outputBlob, combo.filename)
  }
}
