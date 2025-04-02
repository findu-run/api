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
        querystring: z.any(), // Aceita qualquer querystring
        body: z.any(), // Aceita qualquer corpo
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
        // Logar exatamente o que chega no console
        console.log('Webhook recebido da Mangofy:')
        console.log('IP:', request.ip)
        console.log('Query:', request.query)
        console.log('Body:', request.body)
        console.log('Headers:', request.headers)

        // Retornar uma resposta simples para a Mangofy
        return reply.send({ message: 'Webhook recebido com sucesso' })
      } catch (error) {
        console.error('Erro ao processar webhook:', error)
        return reply.status(500).send({ message: 'Internal server error' })
      }
    },
  )
}
