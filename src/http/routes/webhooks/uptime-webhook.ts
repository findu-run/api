import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { sendNotification } from '@/lib/notifier/send'
import { prisma } from '@/lib/prisma'

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
        return reply.status(200).send({ ok: true }) // ignora testes
      }

      const event =
        heartbeat.status === 0
          ? 'monitoring.down'
          : heartbeat.status === 1
            ? 'monitoring.up'
            : 'monitoring.unstable'

      const monitorName = monitor.name
      const url = monitor.url

      const users = await prisma.user.findMany({
        where: {
          barkKey: {
            not: null,
          },
        },
        select: {
          name: true,
          barkKey: true,
        },
      })

      for (const user of users) {
        await sendNotification({
          event,
          orgName: user.name,
          // monitorName,
          // message: msg,
          url,
          deviceKey: user.barkKey!,
          level: heartbeat.status === 0 ? 'critical' : undefined,
          volume: heartbeat.status === 0 ? 5 : undefined,
          skipApprise: false,
        })
      }

      return reply.send({ ok: true })
    },
  )
}
