import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'

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
          summary: 'Create a new organization with a trial plan',
          security: [{ bearerAuth: [] }],
          body: z.object({
            name: z.string(),
            domain: z.string().nullish(),
            shouldAttachUsersByDomain: z.boolean().optional(),
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
        const { name, domain, shouldAttachUsersByDomain } = request.body

        const slug = createSlug(name)

        const existing = await prisma.organization.findUnique({
          where: { slug },
        })
        if (existing) {
          throw new BadRequestError('Slug already in use')
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

        // Busca o plano TRIAL
        const plan = await prisma.plan.findFirst({
          where: { type: 'TRIAL' },
          select: { id: true, isTrialAvailable: true },
        })

        if (!plan) {
          throw new NotFoundError('Trial plan not found.')
        }

        // Verifica se o usuário já usou um trial como dono
        const userTrialHistory = await prisma.subscription.findFirst({
          where: {
            organization: {
              ownerId: userId, // Só olha orgs onde o usuário é dono
            },
            plan: {
              type: 'TRIAL', // Associações com plano TRIAL
            },
          },
        })

        if (userTrialHistory) {
          throw new BadRequestError(
            'You have already used a trial period. Please choose a paid plan to create a new organization.',
          )
        }

        const organization = await prisma.organization.create({
          data: {
            name,
            slug,
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

        const now = convertToBrazilTime(new Date())
        const trialEndsAt = plan.isTrialAvailable
          ? now.add(7, 'day').toDate()
          : null
        const currentPeriodEnd = trialEndsAt ?? now.add(30, 'day').toDate()

        const subscription = await prisma.subscription.create({
          data: {
            organizationId: organization.id,
            planId: plan.id,
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
