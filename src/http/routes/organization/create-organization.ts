import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import dayjs from 'dayjs'

import { prisma } from '@/lib/prisma'
import { createSlug } from '@/utils/create-slug'
import { auth } from '@/http/middlewares/auth'
import { BadRequestError } from '@/http/_errors/bad-request-error'
import { NotFoundError } from '@/http/_errors/not-found-error'

export async function createOrganization(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/organizations',
      {
        schema: {
          tags: ['Organizations'],
          summary: 'Create a new organization with a subscription plan',
          security: [{ bearerAuth: [] }],
          body: z.object({
            name: z.string(),
            domain: z.string().nullish(),
            shouldAttachUsersByDomain: z.boolean().optional(),
            planId: z.string().uuid(),
          }),
          response: {
            201: z.object({
              organizationId: z.string().uuid(),
              subscriptionId: z.string().uuid(),
              status: z.string(),
              trialEndsAt: z.date().nullable(),
            }),
          },
        },
      },
      async (request, reply) => {
        const userId = await request.getCurrentUserId()
        const { name, domain, shouldAttachUsersByDomain, planId } = request.body

        const plan = await prisma.plan.findUnique({
          where: { id: planId },
          select: { id: true, isTrialAvailable: true },
        })

        if (!plan) {
          throw new BadRequestError('Invalid plan selected.')
        }

        if (domain) {
          const organizationByDomain = await prisma.organization.findUnique({
            where: { domain },
          })

          if (organizationByDomain) {
            throw new BadRequestError(
              'Another organization with the same domain already exists.',
            )
          }
        }

        const organization = await prisma.organization.create({
          data: {
            name,
            slug: createSlug(name),
            domain,
            shouldAttachUsersByDomain,
            ownerId: userId,
            members: {
              create: {
                userId,
                role: 'OWNER',
              },
            },
          },
        })

        // 🔥 Definir a data de trial, se aplicável
        const trialEndsAt = plan.isTrialAvailable ? dayjs().add(7, 'day').toDate() : null

        // 🔥 Definir o período atual da assinatura (30 dias para planos pagos)
        const currentPeriodEnd = trialEndsAt ?? dayjs().add(30, 'day').toDate()
        
        const betaPlanId = await prisma.plan.findFirst({
          where: {
            type: 'TRIAL'
          }
        })

        if(!betaPlanId){
          throw new NotFoundError('Not faound plan')
        }

        // 🔥 Criar a assinatura (Subscription)
        const subscription = await prisma.subscription.create({
          data: {
            organizationId: organization.id,
            planId: betaPlanId.id,
            status: plan.isTrialAvailable ? 'TRIALING' : 'ACTIVE',
            currentPeriodEnd,
          },
        })

        return reply.status(201).send({
          organizationId: organization.id,
          subscriptionId: subscription.id,
          status: subscription.status,
          trialEndsAt,
        })
      },
    )
}
