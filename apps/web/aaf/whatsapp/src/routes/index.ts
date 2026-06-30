import { Hono } from 'hono'
import type { Env } from '../types/env'
import { requestLogger } from '@repo/middleware'
import { verifyWebhook } from '../controllers/incoming/verify'
import { handleWebhook } from '../controllers/incoming/message'
import { healthCheck } from '../controllers/incoming/health'
import { handleSend } from '../controllers/outgoing/send'

const router = new Hono<{ Bindings: Env }>()

router.use('*', requestLogger('whatsapp'))

router.get('/webhook', verifyWebhook)
router.post('/webhook', handleWebhook)
router.get('/health', healthCheck)
router.post('/send', handleSend)

export { router }
