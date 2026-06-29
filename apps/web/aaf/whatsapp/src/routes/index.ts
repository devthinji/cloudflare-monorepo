import { Hono } from 'hono'
import type { Env } from '../types/env'
import { verifyWebhook, handleWebhook } from '../controllers/webhook'
import { healthCheck } from '../controllers/health'

const router = new Hono<{ Bindings: Env }>()

router.get('/webhooks/whatsapp', verifyWebhook)
router.post('/webhooks/whatsapp', handleWebhook)
router.get('/health', healthCheck)

export { router }
