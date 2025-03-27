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
        summary:
          'Recebe alertas de instabilidade ou mensagens livres do monitoramento',
        body: z.object({
          monitor: z.string().optional(),
          status: z.enum(['up', 'down', 'warn']).optional(),
          event: z
            .enum([
              'payment.confirmed',
              'purchase.created',
              'subscription.expiring',
              'usage.limit-reached',
              'monitoring.down',
              'monitoring.up',
              'monitoring.unstable',
              'custom.manual',
              'user.bark-connected',
            ])
            .optional(),
          title: z.string().optional(),
          message: z.string().optional(),
          url: z.string().optional(),
          icon: z.string().optional(),
          level: z.enum(['active', 'timeSensitive', 'critical']).optional(),
          volume: z.number().min(0).max(10).optional(),
          deviceKey: z.string().optional(),
          deviceKeys: z.array(z.string()).optional(),
        }),
        response: {
          200: z.object({ ok: z.boolean() }),
        },
      },
    },
    async (request, reply) => {
      const {
        monitor,
        status,
        event,
        title,
        message,
        url,
        icon,
        level,
        volume,
        deviceKey,
        deviceKeys,
      } = request.body

      const selectedEvent =
        event ||
        (status === 'down'
          ? 'monitoring.down'
          : status === 'up'
            ? 'monitoring.up'
            : 'monitoring.unstable')

      const result: any = await sendNotification({
        event: selectedEvent,
        monitorName: monitor,
        title: title,
        message: message,
        icon,
        url,
        level,
        volume,
        deviceKey,
        deviceKeys,
      })

      console.log('[🔔 Notification Result]', result)

      return reply.send({ ok: true })
    },
  )
}
