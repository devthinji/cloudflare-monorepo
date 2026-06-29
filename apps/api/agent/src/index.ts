import { routeAgentRequest } from 'agents'
import type { AgentWorkerEnv } from '@repo/types'
import app from './routes'

export { AgentWorker } from './services/AgentWorker'

export default {
  async fetch(request: Request, env: AgentWorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const agentRes = await routeAgentRequest(request, env)
    if (agentRes) return agentRes
    return app.fetch(request, env, ctx)
  },
}
