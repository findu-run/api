import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { sendNotification } from '@/lib/notifier/send'

export async function uptimeWebhook(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/webhooks/uptime',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Recebe alertas de instabilidade ou queda de serviço',
        body: z.object({
          monitor: z.string(), // Nome do serviço monitorado
          status: z.enum(['up', 'down', 'warn']),
          message: z.string().optional(), // Mensagem enviada pelo monitor
          url: z.string().optional(), // URL do serviço monitorado
        }),
        response: {
          200: z.object({
            ok: z.boolean(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { monitor, status, message, url } = request.body

      const event =
        status === 'down'
          ? 'monitoring.down'
          : status === 'up'
            ? 'monitoring.up'
            : 'monitoring.unstable'

      await sendNotification({
        event,
        monitorName: monitor,
        message, // vai ser usada se definida
        url,
        // você pode forçar o som alto apenas para eventos críticos
        level: status === 'down' ? 'critical' : undefined,
        volume: status === 'down' ? 5 : undefined,
        skipApprise: false, // pode deixar true se quiser enviar só Bark
      })

      return reply.send({ ok: true })
    },
  )
}
