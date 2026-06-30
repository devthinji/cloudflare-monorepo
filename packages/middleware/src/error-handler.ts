import type { ErrorHandler } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { err } from '@repo/utils'

export function errorHandler(): ErrorHandler {
  return (error, c) => {
    const status = (error instanceof HTTPException ? error.status : 500) as ContentfulStatusCode
    const message = status < 500 ? error.message : 'Internal server error'
    return c.json(err(message), status)
  }
}

class HTTPException extends Error {
  constructor(
    public status: number,
    message?: string,
  ) {
    super(message ?? getDefaultMessage(status))
    this.name = 'HTTPException'
  }
}

function getDefaultMessage(status: number): string {
  switch (status) {
    case 400: return 'Bad request'
    case 401: return 'Unauthorized'
    case 403: return 'Forbidden'
    case 404: return 'Not found'
    case 409: return 'Conflict'
    case 422: return 'Unprocessable entity'
    case 429: return 'Too many requests'
    default:  return 'Internal server error'
  }
}

export { HTTPException }
