import { env } from '@/env'

import type { PaymentGateway } from './types'
import { MangofyGateway } from './mongofy'

export async function getGateway(): Promise<PaymentGateway> {
  return new MangofyGateway({
    apiKey: env.MANGOFY_STORE_CODE,
    secretKey: env.MANGOFY_SECRET_KEY,
  })
}
