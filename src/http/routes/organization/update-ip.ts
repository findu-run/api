import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import dayjs from 'dayjs'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsOwner } from '@/utils/permissions'
import { BadRequestError } from '@/http/_errors/bad-request-error'
import { NotFoundError } from '@/http/_errors/not-found-error'

export async function updateIpAddress(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/organizations/:slug/ips/:ipId',
      {
        schema: {
          tags: ['IP Addresses'],
          summary: 'Change an existing authorized IP',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            ipId: z.string().uuid(),
          }),
          body: z.object({
            newIp: z
              .string()
              .regex(/^(?:\d{1,3}\.){3}\d{1,3}$/, 'Invalid IPv4 format'),
            name: z.string().nullable().optional(), // ✅ Adicionado
          }),
          response: {
            200: z.object({
              ipId: z.string().uuid(),
              oldIp: z.string(),
              newIp: z.string(),
              name: z.string().nullable().optional(), // ✅ Adicionado na resposta
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug, ipId } = request.params
        const { newIp, name } = request.body
        const userId = await request.getCurrentUserId()

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: {
            id: true,
            ownerId: true,
            subscription: {
              select: {
                status: true,
                plan: { select: { ipChangeLimit: true } },
              },
            },
            addons: {
              where: { type: 'EARLY_IP_CHANGE' },
              select: { id: true, amount: true },
            },
          },
        })

        if (!organization) throw new NotFoundError('Organization not found.')
        await ensureIsOwner(userId, organization.id)

        if (
          !organization.subscription ||
          organization.subscription.status !== 'ACTIVE'
        ) {
          throw new BadRequestError(
            'Organization does not have an active subscription.',
          )
        }

        const ipRecord = await prisma.ipAddress.findUnique({
          where: { id: ipId },
        })

        if (!ipRecord || ipRecord.organizationId !== organization.id) {
          throw new NotFoundError(
            'IP address not found or does not belong to this organization.',
          )
        }

        const lastIpChangeTime = dayjs(ipRecord.updatedAt)
        const minTimeToChange = organization.subscription.plan.ipChangeLimit
        const nextAllowedChange = lastIpChangeTime.add(minTimeToChange, 'hour')

        if (dayjs().isBefore(nextAllowedChange)) {
          if (organization.addons.length > 0) {
            const usedAddon = organization.addons[0]
            await prisma.addon.update({
              where: { id: usedAddon.id },
              data: { amount: usedAddon.amount - 1 },
            })
          } else {
            throw new BadRequestError(
              `You must wait until ${nextAllowedChange.format(
                'YYYY-MM-DD HH:mm',
              )} to change this IP, or purchase an "Early IP Change" addon.`,
            )
          }
        }

        const updatedIp = await prisma.ipAddress.update({
          where: { id: ipId },
          data: {
            ip: newIp,
            name: name ?? null, // ✅ Atualização do nome
            updatedAt: new Date(),
          },
        })

        return reply.send({
          ipId: updatedIp.id,
          oldIp: ipRecord.ip,
          newIp: updatedIp.ip,
          name: updatedIp.name,
        })
      },
    )
}
