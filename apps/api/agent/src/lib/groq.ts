import type { NormalisedMessage } from '@repo/types'

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions'

export interface GroqMessage {
  role:    'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export interface GroqResponse {
  id:      string
  choices: { message: { content: string }; finish_reason: string }[]
  usage:   { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export async function callGroq(
  apiKey:       string,
  systemPrompt: string,
  history:      GroqMessage[],
  userMessage:  string,
  model =       'llama-3.3-70b-versatile'
): Promise<GroqResponse> {
  const messages: GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user',   content: userMessage },
  ]

  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens:   1024,
      temperature:  0.7,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Groq error ${res.status}: ${text}`)
  }

  return res.json() as Promise<GroqResponse>
}

// ── Normalise incoming WhatsApp message to text ───────────────────────────────

export function extractText(msg: NormalisedMessage): string {
  return msg.text?.trim() ?? ''
}
