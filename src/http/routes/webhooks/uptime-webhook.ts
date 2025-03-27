import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifier/send'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import dayjs from 'dayjs'

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
              status: z.number().int().min(0).max(2),
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
          200: z.object({ ok: z.boolean() }),
        },
      },
    },
    async (request, reply) => {
      const { heartbeat, monitor, msg } = request.body

      if (!heartbeat || !monitor) {
        return reply.status(200).send({ ok: true })
      }

      const event =
        heartbeat.status === 0
          ? 'monitoring.down'
          : heartbeat.status === 1
            ? 'monitoring.up'
            : 'monitoring.unstable'

      const monitorName = monitor.name
      const url = monitor.url
      const message = msg || heartbeat.msg || null

      // Evita duplicidade nos últimos 10 minutos
      const duplicate = await prisma.monitoringEvent.findFirst({
        where: {
          name: monitorName,
          status: heartbeat.status,
          detectedAt: {
            gte: dayjs().subtract(10, 'minutes').toDate(),
          },
        },
      })

      if (duplicate) {
        return reply.send({ ok: true })
      }

      await prisma.monitoringEvent.create({
        data: {
          name: monitorName,
          status: heartbeat.status,
          url,
          message,
        },
      })

      // Busca todos os tokens ativos com deviceKey
      const tokens = await prisma.token.findMany({
        where: {
          type: 'BARK_CONNECT',
          deviceKey: { not: null },
        },
        select: {
          deviceKey: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      })

      for (const token of tokens) {
        await sendNotification({
          event,
          url: 'https://app.findu.run/',
          orgName: token.user.name,
          deviceKey: token.deviceKey!,
          skipApprise: true,
        })
      }

      return reply.send({ ok: true })
    },
  )
}
