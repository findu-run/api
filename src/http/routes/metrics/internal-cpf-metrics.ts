import { getCpfApiMetrics } from '@/http/external/cpf'
import type { FastifyInstance } from 'fastify'

export async function metricsInternalCPF(app: FastifyInstance) {
  app.get('/internal-cpf-metrics', async (request, reply) => {
    const metrics = getCpfApiMetrics()
    return reply.send(metrics)
  })
}
