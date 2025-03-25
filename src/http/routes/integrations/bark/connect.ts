import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifier/send'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { auth } from '@/http/middlewares/auth'

export async function connectBark(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/integrations/bark/connect',
    {
      schema: {
        tags: ['Integrations'],
        summary: 'Connect Bark to user via temporary session token',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          session: z.string().uuid(),
          key: z.string().min(5),
          deviceToken: z.string().optional(), // só se quiser logar
        }),
        response: {
          204: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { session, key } = request.query

      const sessionRecord = await prisma.barkSession.findUnique({
        where: { token: session },
        include: { user: true },
      })

      if (!sessionRecord) {
        throw new Error('Invalid session')
      }

      await prisma.user.update({
        where: { id: sessionRecord.userId },
        data: { barkKey: key },
      })

      await prisma.barkSession.delete({ where: { token: session } })

      await sendNotification({
        event: 'user.bark-connected',
        title: '✅ Dispositivo conectado!',
        message:
          'Agora você receberá notificações da Findu direto no seu iPhone. 📲',
        deviceKey: key,
        skipApprise: true,
      })

      return reply.status(204).send()
    },
  )
}
