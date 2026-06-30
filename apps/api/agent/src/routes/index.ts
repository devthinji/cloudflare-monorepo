import { Hono } from 'hono'
import type { AgentWorkerEnv } from '@repo/types'
import { ok, now } from '@repo/utils'
import { err } from '@repo/utils'
import { createLogger } from '@repo/middleware'
import { AgentIntelligence } from '../controllers/config'
import { requestLogger } from '@repo/middleware'
import * as AgentsCtrl from '../controllers/agents'
import * as CustomersCtrl from '../controllers/customers'
import * as ChatCtrl    from '../controllers/chat'
import * as ConvCtrl    from '../controllers/conversations'

const app = new Hono<{ Bindings: AgentWorkerEnv }>()

app.use('*', requestLogger('agent'))
app.use('*', (c, next) => new AgentIntelligence(c.env).middleware(c, next))

app.get('/health', (c) => c.json(ok({ status: 'ok', service: 'api-agent', timestamp: now() })))

app.get('/api/v1/agent/agents',                 AgentsCtrl.listAgents)
app.get('/api/v1/agent/agents/:slug',            AgentsCtrl.getAgent)
app.post('/api/v1/agent/agents',                 AgentsCtrl.createAgent)
app.put('/api/v1/agent/agents/:slug',            AgentsCtrl.updateAgent)
app.delete('/api/v1/agent/agents/:slug',         AgentsCtrl.deleteAgent)

app.post('/api/v1/agent/chat',                   ChatCtrl.chat)

app.get('/api/v1/agent/customers/:customerId',    CustomersCtrl.getCustomer)
app.post('/api/v1/agent/customers',               CustomersCtrl.createOrUpdateCustomer)
app.patch('/api/v1/agent/customers/:customerId',  CustomersCtrl.patchCustomer)
app.get('/api/v1/agent/customers',                CustomersCtrl.listCustomers)

app.get('/api/v1/agent/conversations/:userId',   ConvCtrl.listConversations)
app.get('/api/v1/agent/conversations/:id/messages', ConvCtrl.listMessages)

app.onError((e, c) => { createLogger('agent', c.env).error({ err: e }, 'unhandled'); return c.json(err('Internal server error'), 500) })

export default app
