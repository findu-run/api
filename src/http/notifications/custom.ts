import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { NotificationEvent } from '@/lib/notifier/events'
import { getFunnyNotificationMessage } from '@/lib/notifier/get-funny-notification-message'
import { sendBarkDirect } from '@/lib/notifier/providers/bark/bark-direct'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { auth } from '../middlewares/auth'

export async function sendFunnyOrCustomNotificationRoute(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post('/notifications/custom/send', {
      schema: {
        tags: ['Notifications'],
        summary: 'Enviar notificação para todos ou usuários por email',
        body: z.object({
          event: z.custom<NotificationEvent>().optional(),
          orgName: z.string().optional(),
          monitorName: z.string().optional(),
          customTitle: z.string().optional(),
          customMessage: z.string().optional(),
          emails: z.array(z.string().email()).optional(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            sent: z.number(),
          }),
        },
      },

      async handler(request, reply) {
        const {
          event = 'custom.manual',
          orgName,
          monitorName,
          customTitle,
          customMessage,
          emails,
        } = request.body

        const users = await prisma.user.findMany({
          where: {
            ...(emails ? { email: { in: emails } } : {}),
            barkKey: { not: null },
          },
          select: {
            email: true,
            name: true,
            barkKey: true,
          },
        })

        if (!users.length) {
          return reply.status(404).send({ success: false, sent: 0 })
        }

        await Promise.all(
          users.map((user) => {
            const { title, message } = getFunnyNotificationMessage({
              event,
              orgName: orgName ?? user.name ?? user.email,
              monitorName,
              customTitle,
              customMessage,
            })

            return sendBarkDirect({
              title,
              body: message,
              device_key: user.barkKey!,
            })
          }),
        )

        return reply.send({
          success: true,
          sent: users.length,
        })
      },
    })
}
