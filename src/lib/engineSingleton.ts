import { WasmEngine } from '../engine/WasmEngine'

// Singleton engine instance
let engine: WasmEngine | null = null

export function getEngine(): WasmEngine {
  if (!engine) engine = new WasmEngine()
  return engine
}
