// ─── PipelineFactory ──────────────────────────────────────────────────────────
//
// A registry of converters keyed by (inputType, outputType).
// Any code can register a handler; the factory picks the right one at runtime.
//
// Usage:
//   factory.register('docx', 'placeholder_schema', myHandler)
//   const result = await factory.run(fileBuffer, 'docx', 'placeholder_schema', env)

import type { DocgenWorkerEnv } from '@repo/types'
import type { FieldSchema }     from './field-schema'

// ─── Output types ────────────────────────────────────────────────────────────

export interface ConvertResult {
  placeholder_schema?: FieldSchema[]   // extracted field definitions
  text?:               string          // plain text extraction
  markdown?:           string          // markdown representation
  fileKey?:            string          // R2 key for stored binary output (png etc.)
  description?:        string          // AI-generated visual description
  error?:              string
}

// ─── Handler signature ────────────────────────────────────────────────────────

export type ConvertHandler = (
  file:    ArrayBuffer,
  env:     DocgenWorkerEnv,
  options?: Record<string, unknown>,
) => Promise<ConvertResult>

// ─── Registry key ────────────────────────────────────────────────────────────

function key(input: string, output: string): string {
  return `${input.toLowerCase()}:${output.toLowerCase()}`
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export class PipelineFactory {
  private handlers = new Map<string, ConvertHandler>()

  // Register a converter
  register(inputType: string, outputType: string, handler: ConvertHandler): this {
    this.handlers.set(key(inputType, outputType), handler)
    return this
  }

  // Check if a converter is registered
  supports(inputType: string, outputType: string): boolean {
    return this.handlers.has(key(inputType, outputType))
  }

  // Run a conversion
  async run(
    file:       ArrayBuffer,
    inputType:  string,
    outputType: string,
    env:        DocgenWorkerEnv,
    options?:   Record<string, unknown>,
  ): Promise<ConvertResult> {
    const handler = this.handlers.get(key(inputType, outputType))
    if (!handler) {
      return { error: `No converter registered for ${inputType} → ${outputType}` }
    }
    try {
      return await handler(file, env, options)
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }

  // List all registered conversions
  list(): { input: string; output: string }[] {
    return [...this.handlers.keys()].map(k => {
      const [input, output] = k.split(':')
      return { input: input!, output: output! }
    })
  }
}

// ─── Singleton factory instance ───────────────────────────────────────────────
// Import this everywhere — register handlers at startup in index.ts

export const pipelineFactory = new PipelineFactory()
