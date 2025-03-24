import dayjs from 'dayjs'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

export async function healthChecker(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get('/health', async (_, reply) => {
    return reply.status(200).send({
      status: 'ok',
      service: 'findu-api',
      version: '1.0.0',
      timestamp: dayjs(new Date().toISOString())
        .tz('America/Sao_Paulo')
        .format('YYYY-MM-DD HH:00'),
    })
  })
}
