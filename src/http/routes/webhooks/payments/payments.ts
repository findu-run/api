import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

export async function paymentWebhookRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/webhooks/payments',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Recebe notificação de pagamento do Mangofy',
        querystring: {
          // Mantemos apenas o provider no querystring, sem validação por enquanto
        },
        body: {}, // Sem validação do corpo
        response: {
          200: { message: 'Webhook recebido com sucesso' },
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
