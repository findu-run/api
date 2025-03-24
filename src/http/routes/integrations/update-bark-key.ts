import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { sendNotification } from '@/lib/notifier/send'

export async function updateUserBarkKey(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/users/me/bark-key',
      {
        schema: {
          tags: ['Users'],
          summary: 'Set or update user Bark key',
          security: [{ bearerAuth: [] }],
          body: z.object({
            barkKey: z.string().min(5),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const userId = await request.getCurrentUserId()
        const { barkKey } = request.body

        await prisma.user.update({
          where: { id: userId },
          data: { barkKey },
        })
        const updated = await prisma.user.update({
          where: { id: userId },
          data: { barkKey },
        })

        // 🔔 Envia notificação para o próprio usuário
        if (updated.barkKey) {
          await sendNotification({
            event: 'user.bark-connected',
            title: '✅ Dispositivo conectado!',
            message:
              'Agora você receberá notificações direto no seu iPhone. 🔔',
            deviceKey: updated.barkKey,
            skipApprise: true,
          })
        }
        return reply.status(204).send()
      },
    )
}
