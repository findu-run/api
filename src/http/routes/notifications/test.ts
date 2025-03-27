import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifier/send'

import type { NotificationEvent } from '@/lib/notifier/events'

export async function testNotificationRoute(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/notifications/test',
      {
        schema: {
          tags: ['Notifications'],
          summary: 'Send test notification to user (Bark)',
          security: [{ bearerAuth: [] }],
          body: z.object({
            event: z.custom<NotificationEvent>(),
          }),
          response: {
            200: z.object({
              ok: z.boolean(),
            }),
          },
        },
      },
      async (request, reply) => {
        const userId = await request.getCurrentUserId()
        const { event } = request.body

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            name: true,
            barkKey: true,
          },
        })

        if (!user?.barkKey) {
          throw new Error('Usuário não tem uma chave Bark configurada.')
        }

        await sendNotification({
          event,
          orgName: user.name,
          deviceKey: user.barkKey,
          skipApprise: true,
        })

        return reply.send({ ok: true })
      },
    )
}
