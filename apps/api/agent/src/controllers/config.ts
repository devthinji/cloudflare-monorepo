import {
  Agent,
  getAgentByName,
  routeAgentRequest,
  type AgentNamespace,
  type AgentOptions,
} from 'agents'
import { agentsMiddleware } from 'hono-agents'
import { callWithFallback, type LlmMessage } from '@repo/llm-service'
import type { AgentWorkerEnv, Agent as AgentConfig } from '@repo/types'
import type { AgentWorker } from '../services/AgentWorker'

export { Agent, getAgentByName, routeAgentRequest, agentsMiddleware }
export type { AgentOptions }

export type RouteIntent = 'agent_do' | 'chat' | 'crud' | 'health' | 'unknown'

export interface RouteAnalysis {
  intent:     RouteIntent
  path:       string
  method:     string
  target?:    string
  confidence: number
}

const KNOWN_ROUTES: { pattern: RegExp; method?: string; intent: RouteIntent; target: string }[] = [
  { pattern: /^\/agents\//,                          intent: 'agent_do', target: 'agents-sdk' },
  { pattern: /^\/api\/v1\/agent\/chat$/, method: 'POST', intent: 'chat',   target: 'chat' },
  { pattern: /^\/health$/,                          intent: 'health', target: 'health' },
  { pattern: /^\/api\/v1\/agent\//,                intent: 'crud',   target: 'rest' },
]

const ROUTE_REASONING_PROMPT = `You classify HTTP requests for a Cloudflare Agents API worker.
Reply with JSON only: {"intent":"agent_do"|"chat"|"crud"|"health"|"unknown","target":"<handler>","confidence":0-1}`

/**
 * Central AI + Agents SDK configuration.
 * Routes Durable Object agents via the SDK and uses LLM reasoning for ambiguous paths.
 */
export class AgentIntelligence {
  constructor(
    private readonly env: AgentWorkerEnv,
    private readonly options?: AgentOptions<AgentWorkerEnv>,
  ) {}

  /** Hono middleware — delegates /agents/* WebSocket and HTTP traffic to the Agents SDK */
  get middleware() {
    return agentsMiddleware<{ Bindings: AgentWorkerEnv }>()
  }

  /** Route through Cloudflare Agents SDK (Durable Object agents) */
  routeAgentRequest(request: Request): Promise<Response | null> {
    return routeAgentRequest(request, this.env, this.options)
  }

  /** Resolve an AgentWorker stub for a user/session */
  getWorker(userId: string) {
    const ns = this.env.AGENT_DO as unknown as AgentNamespace<AgentWorker>
    return getAgentByName<AgentWorkerEnv, AgentWorker>(ns, userId)
  }

  /** Classify a request — static rules first, LLM fallback for unknown paths */
  async analyzeRoute(request: Request, agent?: AgentConfig | null): Promise<RouteAnalysis> {
    const url    = new URL(request.url)
    const path   = url.pathname
    const method = request.method

    for (const rule of KNOWN_ROUTES) {
      if (rule.pattern.test(path) && (!rule.method || rule.method === method)) {
        return { intent: rule.intent, path, method, target: rule.target, confidence: 1 }
      }
    }

    return this.reasonAboutRoute(path, method, agent)
  }

  private async reasonAboutRoute(
    path: string,
    method: string,
    agent?: AgentConfig | null,
  ): Promise<RouteAnalysis> {
    try {
      const { content } = await callWithFallback({
        model: agent?.modelId ?? 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          { role: 'system', content: ROUTE_REASONING_PROMPT },
          { role: 'user',   content: `${method} ${path}` },
        ] satisfies LlmMessage[],
        maxTokens:   128,
        temperature: 0,
      }, this.env)

      const parsed = JSON.parse(content.replace(/```json?\s*|\s*```/g, '')) as Partial<RouteAnalysis>
      return {
        intent:     parsed.intent ?? 'unknown',
        path,
        method,
        target:     parsed.target,
        confidence: parsed.confidence ?? 0.5,
      }
    } catch {
      return { intent: 'unknown', path, method, confidence: 0 }
    }
  }
}
