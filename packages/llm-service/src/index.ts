import type { AgentWorkerEnv, DocgenWorkerEnv } from '@repo/types'

// ─── Types ──────────────────────────────────────────────────────────────────

export type LlmProvider = 'openrouter' | 'workers-ai'

export interface LlmMessage {
  role:    'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export interface LlmRequest {
  provider?:   LlmProvider
  model?:      string
  messages:    LlmMessage[]
  maxTokens?:  number
  temperature?: number
}

export interface LlmResponse {
  content:    string
  finishReason?: string
  tokensIn?:  number
  tokensOut?: number
}

type AiEnv = Pick<AgentWorkerEnv | DocgenWorkerEnv, 'AI' | 'OPENROUTER_API_KEY'>

// ─── Defaults ───────────────────────────────────────────────────────────────

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free'

const WORKERS_AI_TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct'

const DEFAULT_MAX_TOKENS = 1024
const DEFAULT_TEMPERATURE = 0.7
const RETRY_BACKOFF_MS = 1000

// ─── OpenRouter client ──────────────────────────────────────────────────────

async function callOpenRouter(req: LlmRequest, env: AiEnv): Promise<LlmResponse> {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set')

  const res = await fetch(OPENROUTER_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:       req.model ?? OPENROUTER_DEFAULT_MODEL,
      messages:    req.messages,
      max_tokens:  req.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${text}`)
  }

  const data = await res.json() as {
    choices: { message: { content: string }; finish_reason: string }[]
    usage?: { prompt_tokens: number; completion_tokens: number }
  }

  return {
    content:      data.choices[0]?.message.content ?? '',
    finishReason: data.choices[0]?.finish_reason,
    tokensIn:     data.usage?.prompt_tokens,
    tokensOut:    data.usage?.completion_tokens,
  }
}

// ─── Workers AI client ──────────────────────────────────────────────────────

async function callWorkersAi(req: LlmRequest, env: AiEnv): Promise<LlmResponse> {
  if (!env.AI) throw new Error('Workers AI binding (env.AI) not available')

  const model = req.model ?? WORKERS_AI_TEXT_MODEL
  const input = {
    messages:    req.messages,
    max_tokens:  req.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: req.temperature ?? DEFAULT_TEMPERATURE,
  }

  const result = await (env.AI as any).run(model, input)
  const response = result?.response ?? ''

  return {
    content:      response,
    finishReason: 'stop',
  }
}

// ─── Provider chain ─────────────────────────────────────────────────────────

async function callWithBackoff(
  fn: () => Promise<LlmResponse>,
  retries: number,
): Promise<LlmResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries) throw err
      await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS * (attempt + 1)))
    }
  }
  throw new Error('unreachable')
}

export async function call(req: LlmRequest, env: AiEnv): Promise<LlmResponse> {
  const provider = req.provider ?? 'openrouter'

  if (provider === 'openrouter') {
    return callOpenRouter(req, env)
  }
  if (provider === 'workers-ai') {
    return callWorkersAi(req, env)
  }
  throw new Error(`Unknown provider: ${provider}`)
}

export async function callWithFallback(req: LlmRequest, env: AiEnv): Promise<LlmResponse> {
  // Tier 1: OpenRouter (with one retry)
  try {
    return await callWithBackoff(() => callOpenRouter(req, env), 1)
  } catch (orErr) {
    console.warn('OpenRouter failed, falling back to Workers AI:', (orErr as Error).message)
  }

  // Tier 2: Workers AI (no retry — zero-cost, fast)
  return callWorkersAi(req, env)
}
