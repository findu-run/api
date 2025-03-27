import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'
import { sendNotification } from '@/lib/notifier/send'

import { authWithBilling } from '@/http/middlewares/auth-with-billing'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { BadRequestError } from '@/http/_errors/bad-request-error'

export async function purchaseAddon(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(authWithBilling)
    .post(
      '/organizations/:slug/billing/addons',
      {
        schema: {
          tags: ['Billing'],
          summary: 'Purchase an addon for an organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          body: z.object({
            type: z.enum(['EXTRA_IP', 'EXTRA_REQUESTS', 'EARLY_IP_CHANGE']),
            amount: z.number().int().min(1).default(1),
          }),
          response: {
            201: z.object({
              message: z.string(),
              addonId: z.string(),
              invoiceId: z.string(),
            }),
            400: z.object({
              message: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params
        const { type, amount } = request.body
        const userId = await request.getCurrentUserId()

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: {
            id: true,
            name: true, // Para notificação
            owner: { select: { id: true } }, // Para buscar o deviceKey do dono
            subscription: {
              select: { id: true, plan: { select: { price: true } } },
            },
          },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        if (!organization.subscription) {
          throw new BadRequestError('Organization has no active subscription.')
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        const PRICES = {
          EXTRA_IP: 1000, // R$ 10,00 em centavos
          EXTRA_REQUESTS: 2, // R$ 0,02 por requisição em centavos
          EARLY_IP_CHANGE: 500, // R$ 5,00 em centavos
        }

        const addonPrice = PRICES[type] * amount

        const existingAddon = await prisma.addon.findFirst({
          where: {
            organizationId: organization.id,
            type,
          },
        })

        let addon
        if (existingAddon) {
          addon = await prisma.addon.update({
            where: { id: existingAddon.id },
            data: {
              amount: existingAddon.amount + amount,
              price: existingAddon.price + addonPrice,
            },
          })
        } else {
          addon = await prisma.addon.create({
            data: {
              organizationId: organization.id,
              type,
              amount,
              price: addonPrice,
            },
          })
        }

        const dueDate = convertToBrazilTime(new Date()).add(7, 'day').toDate()
        const invoice = await prisma.invoice.create({
          data: {
            organizationId: organization.id,
            subscriptionId: organization.subscription.id,
            amount: addonPrice,
            dueDate,
            status: 'PENDING',
          },
        })

        // Envia notificação divertida
        const ownerToken = await prisma.token.findFirst({
          where: {
            userId: organization.owner.id,
            type: 'BARK_CONNECT',
          },
          orderBy: { createdAt: 'desc' },
        })

        if (ownerToken?.deviceKey) {
          await sendNotification({
            event: 'purchase.created',
            orgName: organization.name,
            deviceKey: ownerToken.deviceKey,
            skipApprise: false,
          })
        }

        app.log.info(
          `📦 Addon ${type} (${amount}) comprado para org ${organization.id}, fatura ${invoice.id} gerada`,
        )

        return reply.code(201).send({
          message: `Addon ${type} purchased successfully.`,
          addonId: addon.id,
          invoiceId: invoice.id,
        })
      },
    )
}
