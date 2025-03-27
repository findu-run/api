import { fastifyPlugin } from 'fastify-plugin'
import { auth } from './auth'
import { billingGuard } from './billing-guard'

export const authWithBilling = fastifyPlugin(async (app) => {
  await app.register(auth)
  await app.register(billingGuard)
})
