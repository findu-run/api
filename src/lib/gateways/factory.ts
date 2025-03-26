import { env } from '@/env'
import { MangofyGateway } from './mongofy'
import type { PaymentGateway } from './types'

export async function getGateway(): Promise<PaymentGateway> {
  return new MangofyGateway({
    apiKey: env.MANGOFY_STORE_CODE,
    secretKey: env.MANGOFY_SECRET_KEY,
  })
}
