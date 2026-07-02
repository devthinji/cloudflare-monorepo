// ─── Automation step executor ─────────────────────────────────────────────────
//
// Runs a make.com-style linear chain of steps, piping each step's output into
// the next step's input. Two kinds of steps:
//   - "convert": delegates to the PipelineFactory (docx→pdf, text→audio, etc.)
//   - "execute_js": runs a user-provided JS snippet against the running input,
//     for arbitrary API calls / data transforms that don't need a registered
//     converter.
//
// Steps are stored as JSON on the `automation_pipelines` table and executed
// on demand via POST /api/v1/docgen/automations/:id/run.

import type { DocgenWorkerEnv } from '@repo/types'
import { pipelineFactory } from './factory'

export type AutomationStepType = 'convert' | 'execute_js' | 'http_request'

export interface AutomationStep {
  id:   string
  type: AutomationStepType
  // "convert" — reads `input.fileKey` from R2, runs inputType→outputType
  inputType?:  string
  outputType?: string
  // "execute_js" — arbitrary transform, e.g. `return { ...input, total: input.a + input.b }`
  code?: string
  // "http_request" — simple fetch wrapper for calling any external API
  url?:    string
  method?: string
  headers?: Record<string, string>
  bodyTemplate?: string // JSON string, supports {{input.field}} interpolation
}

export interface StepLogEntry {
  stepId: string
  type:   AutomationStepType
  ok:     boolean
  output?: unknown
  error?:  string
  ms:      number
}

export interface RunResult {
  ok:     boolean
  output: unknown
  logs:   StepLogEntry[]
}

function interpolate(template: string, input: unknown): string {
  return template.replace(/\{\{\s*input\.([\w.]+)\s*\}\}/g, (_, path: string) => {
    const value = path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), input)
    return value === undefined ? '' : String(value)
  })
}

async function runStep(
  step:  AutomationStep,
  input: unknown,
  env:   DocgenWorkerEnv,
): Promise<unknown> {
  if (step.type === 'execute_js') {
    if (!step.code) throw new Error('execute_js step has no code')
    // Sandboxed-enough for a single-tenant, single-request execution model —
    // same trust boundary as the rest of this worker's request handling.
    // eslint-disable-next-line no-new-func
    const fn = new Function('input', 'env', `"use strict";\n${step.code}`)
    return await fn(input, { ENVIRONMENT: env.ENVIRONMENT })
  }

  if (step.type === 'http_request') {
    if (!step.url) throw new Error('http_request step has no url')
    const body = step.bodyTemplate ? interpolate(step.bodyTemplate, input) : undefined
    const res = await fetch(step.url, {
      method: step.method ?? 'POST',
      headers: { 'Content-Type': 'application/json', ...(step.headers ?? {}) },
      body,
    })
    const text = await res.text()
    let parsed: unknown = text
    try { parsed = JSON.parse(text) } catch { /* keep as text */ }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
    return parsed
  }

  // "convert" — expects input.fileKey (R2 key) or input.text for text-based converters
  if (!step.inputType || !step.outputType) throw new Error('convert step missing inputType/outputType')

  const inputObj = input as { fileKey?: string; text?: string } | undefined
  let buffer: ArrayBuffer
  if (step.inputType === 'text') {
    buffer = new TextEncoder().encode(inputObj?.text ?? '').buffer as ArrayBuffer
  } else {
    if (!inputObj?.fileKey) throw new Error('convert step expects input.fileKey')
    const obj = await env.DOCS_BUCKET.get(inputObj.fileKey)
    if (!obj) throw new Error(`R2 object not found: ${inputObj.fileKey}`)
    buffer = await obj.arrayBuffer()
  }

  const result = await pipelineFactory.run(buffer, step.inputType, step.outputType, env)
  if (result.error) throw new Error(result.error)
  return result
}

export async function runAutomation(
  steps: AutomationStep[],
  initialInput: unknown,
  env: DocgenWorkerEnv,
): Promise<RunResult> {
  let current = initialInput
  const logs: StepLogEntry[] = []

  for (const step of steps) {
    const start = Date.now()
    try {
      current = await runStep(step, current, env)
      logs.push({ stepId: step.id, type: step.type, ok: true, output: current, ms: Date.now() - start })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      logs.push({ stepId: step.id, type: step.type, ok: false, error, ms: Date.now() - start })
      return { ok: false, output: current, logs }
    }
  }

  return { ok: true, output: current, logs }
}
