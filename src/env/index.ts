import 'dotenv/config'
import { z } from 'zod'

const envSchemas = z.object({
  DATABASE_URL: z.string(),
  // REDIS_URL: z.string(),
  HOST: z.string().default('http://localhost'),
  NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
  JWT_SECRET: z.string(),
  PORT: z.coerce.number().default(3333),
  // GOOGLE_CLIENT_ID: z.string(),
  // GOOGLE_CLIENT_SECRET: z.string(),
  // GITHUB_OAUTH_CLIENT_ID: z.string(),
  // GITHUB_OAUTH_CLIENT_SECRET: z.string(),
  // GITHUB_OAUTH_CLIENT_REDIRECT_URI: z.string(),
  AES_ENCRYPTION_KEY: z.string(),
})

const _env = envSchemas.safeParse(process.env)

if (_env.success === false) {
  console.error('❌ Invalid enviroment variables', _env.error.format())

  throw new Error('Invalid enviroment variables')
}

export const env = _env.data