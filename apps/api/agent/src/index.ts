import type { AgentWorkerEnv } from '@repo/types'
import { AgentIntelligence } from './controllers/config'
import app from './routes'

export { AgentWorker } from './services/AgentWorker'
export { AgentIntelligence } from './controllers/config'

export default {
  async fetch(request: Request, env: AgentWorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const ai       = new AgentIntelligence(env)
    const agentRes = await ai.routeAgentRequest(request)
    if (agentRes) return agentRes
    return app.fetch(request, env, ctx)
  },
}
