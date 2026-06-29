import { defineConfig } from 'drizzle-kit'

const schema = 'apps/api/gateway/drizzle/schema/database.ts'
const out    = 'apps/api/gateway/drizzle/migration'
const localDbPath = process.env.LOCAL_DB_PATH

export default defineConfig(
  localDbPath
    ? {
        dialect: 'sqlite',
        schema,
        out,
        dbCredentials: { url: localDbPath },
      }
    : {
        dialect: 'sqlite',
        driver: 'd1-http',
        schema,
        out,
        dbCredentials: {
          accountId:  process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
          databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID ?? '11909a8f-d177-4a08-a48a-fef7ce0c2df3',
          token:      process.env.CLOUDFLARE_API_TOKEN ?? '',
        },
      },
)
