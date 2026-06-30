import { Hono } from 'hono'
import type { Env } from '../types/env'
import { requestLogger } from '@repo/middleware'
import { verifyWebhook, handleWebhook } from '../controllers/webhook'
import { healthCheck } from '../controllers/health'

const router = new Hono<{ Bindings: Env }>()

router.use('*', requestLogger('whatsapp'))

router.get('/webhooks/whatsapp', verifyWebhook)
router.post('/webhooks/whatsapp', handleWebhook)
router.get('/health', healthCheck)

export { router }
