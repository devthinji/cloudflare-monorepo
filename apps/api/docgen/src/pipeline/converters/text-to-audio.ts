// ─── text → audio ─────────────────────────────────────────────────────────────
//
// Uses Cloudflare Workers AI (no extra secret needed — same `AI` binding
// already used for LLM fallback) to synthesize speech, then stores the
// resulting audio in R2 and returns its object key.

import type { ConvertResult } from '../factory'
import type { DocgenWorkerEnv } from '@repo/types'
import { generateId } from '@repo/utils'

interface WorkersAiTtsResponse {
  audio?: string // base64-encoded MP3
}

export async function textToAudio(
  file:    ArrayBuffer,
  env:     DocgenWorkerEnv,
  options?: Record<string, unknown>,
): Promise<ConvertResult> {
  const text = new TextDecoder().decode(file).trim()
  if (!text) return { error: 'No text provided to synthesize.' }

  const voice = (options?.voice as string) ?? 'default'
  const model = '@cf/myshell-ai/melotts'

  try {
    // env.AI is typed `unknown` in DocgenWorkerEnv — narrow it to the Workers AI shape we need.
    const ai = env.AI as { run: (model: string, input: Record<string, unknown>) => Promise<WorkersAiTtsResponse> }
    const result = await ai.run(model, { prompt: text, lang: voice === 'default' ? 'en' : voice })

    if (!result?.audio) return { error: 'TTS model returned no audio.' }

    const bytes = Uint8Array.from(atob(result.audio), c => c.charCodeAt(0))
    const fileKey = `audio/${generateId()}.mp3`
    await env.DOCS_BUCKET.put(fileKey, bytes, { httpMetadata: { contentType: 'audio/mpeg' } })

    return { fileKey }
  } catch (e) {
    return { error: `TTS synthesis failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}
