import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

export async function uptimeWebhook(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/webhooks/uptime',

    async (request, reply) => {
      console.log('[Webhook Received]', request.body)

      return reply.send({ ok: true })
    },
  )
}
