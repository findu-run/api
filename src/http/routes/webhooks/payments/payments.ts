import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

export async function paymentWebhookRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/webhooks/payments',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Recebe notificação de pagamento do Mangofy',
        querystring: z.object({
          provider: z.string().optional(), // Permitir provider opcional
        }),
        body: z.any(), // Aceitar qualquer payload sem validação
        response: {
          200: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      // Logar tudo que chega
      app.log.info('📥 Webhook chamado!', {
        ip: request.ip,
        query: request.query,
        body: request.body,
        headers: request.headers,
      })

      // Retornar uma resposta simples para a Mangofy
      return reply.send({ message: 'Webhook recebido com sucesso' })
    },
  )
}
