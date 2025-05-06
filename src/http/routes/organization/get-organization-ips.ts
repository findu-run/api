import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { auth } from '@/http/middlewares/auth'

import { NotFoundError } from '@/http/_errors/not-found-error'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'

export async function getOrganizationIps(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations/:slug/ips',
      {
        schema: {
          tags: ['Organizations'],
          summary: 'Listar IPs vinculados a uma organização',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string().min(1),
          }),
          response: {
            200: z.object({
              ips: z.array(
                z.object({
                  name: z.string().nullable(),
                  id: z.string().uuid(),
                  ip: z.string(),
                  authorId: z.string().nullable(),
                  createdAt: z.string(),
                  updatedAt: z.string(),
                }),
              ),
            }),
          },
        },
      },
      async (request, reply) => {
        const userId = await request.getCurrentUserId()
        const { slug } = request.params

        const organization = await prisma.organization.findFirst({
          where: {
            slug,
            members: {
              some: { userId },
            },
          },
        })

        if (!organization) {
          throw new NotFoundError('Organização não encontrada')
        }

        const ips = await prisma.ipAddress.findMany({
          where: {
            organizationId: organization.id,
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        const formattedIps = ips.map((ip) => ({
          id: ip.id,
          ip: ip.ip,
          name: ip.name ?? null,
          authorId: ip.authorId,
          createdAt: convertToBrazilTime(ip.createdAt).toISOString(),
          updatedAt: convertToBrazilTime(ip.updatedAt).toISOString(),
        }))

        return reply.status(200).send({ ips: formattedIps })
      },
    )
}
