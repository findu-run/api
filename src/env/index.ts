import 'dotenv/config'
import { z } from 'zod'

const envSchemas = z.object({
  DATABASE_URL: z.string(),
  // REDIS_URL: z.string(),
  HOST: z.string().default('http://localhost'),
  NODE_ENV: z.enum(['dev', 'test', 'production']).default('dev'),
  JWT_SECRET: z.string(),
  PORT: z.coerce.number().default(3333),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GITHUB_OAUTH_CLIENT_ID: z.string(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string(),
  GITHUB_OAUTH_CLIENT_REDIRECT_URI: z.string(),
  AES_ENCRYPTION_KEY: z.string(),
  API_CONSULT: z.string(),
  API_CPF_SECONDARY_URL: z.string(),
  BARK_SERVER_URL: z.string(),
  APPRISE_URL: z.string(),
  NOTIFY_URL_BARK: z.string(),
  NOTIFY_URL_NTFY: z.string(),
  NOTIFY_URL_EMAIL: z.string(),
  MANGOFY_SECRET_KEY: z.string(),
  MANGOFY_STORE_CODE: z.string(),
})

const _env = envSchemas.safeParse(process.env)

if (_env.success === false) {
  console.error('❌ Invalid enviroment variables', _env.error.format())

  throw new Error('Invalid enviroment variables')
}

export const env = _env.data
