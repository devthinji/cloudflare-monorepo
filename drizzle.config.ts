import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
  schema: 'apps/api/gateway/drizzle/schema/database.ts',
  out: 'apps/api/gateway/drizzle/migration',
})
