import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  // This file tells Prisma where to get the DATABASE_URL for Migrate.
  // Keep DATABASE_URL in your .env (or set it in the environment).
  schema: 'prisma/schema.prisma',
  // No additional options required for local SQLite dev.
  datasource: {
    url: env('DATABASE_URL')
  }
})
