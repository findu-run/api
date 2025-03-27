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
          heartbeat: z
            .object({
              status: z.number().int().min(0).max(2), // 0 = down, 1 = up, 2 = warn
              msg: z.string().optional(),
            })
            .nullable(),
          monitor: z
            .object({
              name: z.string(),
              url: z.string().optional(),
            })
            .nullable(),
          msg: z.string().optional(),
        }),
        response: {
          200: z.object({
            ok: z.boolean(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { heartbeat, monitor, msg } = request.body

      if (!heartbeat || !monitor) {
        return reply.status(200).send({ ok: true }) // ignorar pings de teste
      }

      const status = heartbeat.status
      const monitorName = monitor.name
      const url = monitor.url

      const event =
        status === 0
          ? 'monitoring.down'
          : status === 1
            ? 'monitoring.up'
            : 'monitoring.unstable'

      await sendNotification({
        event,
        monitorName,
        message: msg || heartbeat.msg || undefined,
        url,
        level: status === 0 ? 'critical' : undefined,
        volume: status === 0 ? 5 : undefined,
        skipApprise: false,
      })

      return reply.send({ ok: true })
    },
  )
}
