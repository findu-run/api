import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { prisma } from '@/lib/prisma'
import { registerBarkKey } from '@/lib/oauth-bark'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { auth } from '@/http/middlewares/auth'

export async function registerBark(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/integrations/bark/:deviceToken/register',
      {
        schema: {
          tags: ['Integrations'],
          summary: 'Faz o registro do Bark',
          security: [{ bearerAuth: [] }],
          params: z.object({
            deviceToken: z.string().min(10),
          }),
          response: {
            201: z.object({
              bark_server_uri: z.string(),
            }),
          },
        },
      },
      async (request) => {
        const userId = await request.getCurrentUserId()

        if (!userId) {
          throw new NotFoundError('User not found')
        }

        const { deviceToken } = request.params

        const { device_key, key, device_token } = await registerBarkKey({
          deviceToken,
        })

        await prisma.token.create({
          data: {
            type: 'BARK_CONNECT',
            userId,
            deviceToken: device_token,
            deviceKey: device_key,
            key,
          },
        })

        const bark_server_uri = `bark://addServer?address=https://bark.findu.run/${device_key}`

        return { bark_server_uri }
      },
    )
}
