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
        querystring: z.any(), // Aceita qualquer querystring sem validação
        body: z.any(), // Aceita qualquer body sem validação
        response: {
          200: z.object({
            message: z.string(),
          }),
          500: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        // Logar tudo que chega
        console.log('📥 Webhook chamado!', {
          ip: request.ip,
          query: request.query,
          body: request.body,
          headers: request.headers,
        })

        // Retornar uma resposta simples para a Mangofy
        return reply.send({ message: 'Webhook recebido com sucesso' })
      } catch (error) {
        app.log.error('Erro ao processar webhook:', error)
        return reply.status(500).send({ message: 'Internal server error' })
      }
    },
  )
}
