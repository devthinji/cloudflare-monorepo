import type { Context, Next } from 'hono'
import type { BaseWorkerEnv } from '@repo/types'
import { verifyJwt } from '@repo/utils'
import { err } from '@repo/utils'

export async function jwtMiddleware(
  c: Context<{ Bindings: BaseWorkerEnv & { JWT_SECRET: string } }>,
  next: Next
) {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json(err('Unauthorized'), 401)
  }

  const payload = await verifyJwt(header.slice(7), c.env.JWT_SECRET)
  if (!payload) return c.json(err('Invalid or expired token'), 401)

  await next()
}
