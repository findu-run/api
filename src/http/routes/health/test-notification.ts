import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { sendNotification } from '@/lib/notifier/send'
import type { NotificationEvent } from '@/lib/notifier/events'

export async function testNotification(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/test/notification',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Trigger a test notification manually',
        security: [{ bearerAuth: [] }],
        body: z.object({
          event: z.enum([
            'payment.confirmed',
            'purchase.created',
            'subscription.expiring',
            'usage.limit-reached',
            'monitoring.down',
            'monitoring.up',
            'monitoring.unstable',
            'custom.manual',
            'user.bark-connected',
          ]),
          title: z.string().min(3),
          message: z.string().min(5),
        }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { event, title, message } = request.body as {
        event: NotificationEvent
        title: string
        message: string
      }

      await sendNotification({ event, title, message })

      return reply.status(204).send()
    },
  )
}
