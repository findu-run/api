import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

export async function registerBark(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/bark/register',
    {
      schema: {
        tags: ['Integrations'],
        summary: 'Redireciona o registro Bark para rota de conexão',
        querystring: z.object({
          session: z.string().uuid(),
          key: z.string().min(5),
          deviceToken: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { session, key, deviceToken } = request.query

      return reply.redirect(
        `https://test.findu.run/integrations/bark/connect?session=${session}&key=${key}&deviceToken=${deviceToken ?? ''}`,
      )
    },
  )
}
