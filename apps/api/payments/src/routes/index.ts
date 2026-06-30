import { Hono } from 'hono'
import type { PaymentsWorkerEnv } from '@repo/types'
import { ok, now } from '@repo/utils'
import { err } from '@repo/utils'
import { createLogger } from '../lib/logger'
import { requestLogger } from '@repo/middleware'
import * as MpesaCtrl     from '../controllers/mpesa'
import * as WebhooksCtrl  from '../controllers/webhooks'
import * as TxCtrl        from '../controllers/transactions'

const app = new Hono<{ Bindings: PaymentsWorkerEnv }>()

app.use('*', requestLogger('payments'))

app.get('/health', (c) => c.json(ok({ status: 'ok', service: 'api-payments', timestamp: now() })))

app.post('/api/v1/payments/mpesa/stk',                  MpesaCtrl.initiateStkPush)
app.get('/api/v1/payments/mpesa/stk/:checkoutRequestId', MpesaCtrl.queryStkPush)

app.post('/webhooks/mpesa',                              WebhooksCtrl.handleMpesaCallback)

app.get('/api/v1/payments/transactions/:userId',         TxCtrl.listUserTransactions)
app.post('/api/v1/payments/notify-agent',                TxCtrl.notifyAgent)

app.onError((error, c) => { createLogger(c.env).error({ err: error }, 'unhandled payments error'); return c.json(err('Internal server error'), 500) })

export default app
