import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { authWithBilling } from '@/http/middlewares/auth-with-billing'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { sendNotification } from '@/lib/notifier/send'

export async function cancelAddon(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(authWithBilling)
    .delete(
      '/organizations/:slug/billing/addons/:addonId',
      {
        schema: {
          tags: ['Billing'],
          summary: 'Cancel an addon for an organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            addonId: z.string().uuid(),
          }),
          response: {
            200: z.object({
              message: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug, addonId } = request.params
        const userId = await request.getCurrentUserId()

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: {
            id: true,
            name: true,
            owner: { select: { id: true } },
          },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        const addon = await prisma.addon.findUnique({
          where: { id: addonId },
        })

        if (!addon || addon.organizationId !== organization.id) {
          throw new NotFoundError(
            'Addon not found or does not belong to this organization.',
          )
        }

        await prisma.addon.delete({
          where: { id: addonId },
        })

        // Notifica o dono da organização
        const ownerToken = await prisma.token.findFirst({
          where: {
            userId: organization.owner.id,
            type: 'BARK_CONNECT',
          },
          orderBy: { createdAt: 'desc' },
        })

        if (ownerToken?.deviceKey) {
          await sendNotification({
            event: 'addon.canceled',
            orgName: organization.name,
            deviceKey: ownerToken.deviceKey,
            skipApprise: true,
          })
        }

        app.log.info(
          `🗑️ Addon ${addon.type} (${addonId}) cancelado para org ${organization.id}`,
        )

        return reply.send({
          message: `Addon ${addon.type} canceled successfully.`,
        })
      },
    )
}
