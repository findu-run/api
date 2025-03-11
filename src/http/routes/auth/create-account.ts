import { hash } from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { BadRequestError } from '@/http/_errors/bad-request-error'

export async function createAccount(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/users',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Create a new account',
        body: z.object({
          name: z.string().min(3, 'Name must have at least 3 characters'),
          email: z.string().email(),
          password: z.string().min(8, 'Password must be at least 8 characters long'),
          organizationName: z.string().optional(), // 🔥 Novo campo: Permite criar uma org automaticamente
        }),
      },
    },
    async (request, reply) => {
      const { name, email, password, organizationName } = request.body

      const userWithSameEmail = await prisma.user.findUnique({
        where: { email },
      })

      if (userWithSameEmail) {
        throw new BadRequestError('User with the same e-mail already exists.')
      }

      const passwordHash = await hash(password, 10)

      const [, domain] = email.split('@')

      const autoJoinOrganization = await prisma.organization.findFirst({
        where: {
          domain,
          shouldAttachUsersByDomain: true,
        },
      })

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          member_on: autoJoinOrganization
            ? {
                create: {
                  organizationId: autoJoinOrganization.id,
                  role: 'MEMBER',
                },
              }
            : undefined,
        },
      })

      // Se o usuário informou um nome de organização, criamos uma nova organização para ele
      if (organizationName) {
        const organization = await prisma.organization.create({
          data: {
            name: organizationName,
            slug: organizationName.toLowerCase().replace(/ /g, '-'),
            ownerId: user.id,
            members: {
              create: {
                userId: user.id,
                role: 'OWNER',
              },
            },
          },
        })

        // Criar uma assinatura TRIAL para a nova organização (somente no plano Basic)
        await prisma.subscription.create({
          data: {
            organizationId: organization.id,
            planId: await getBasicPlanId(),
            status: 'TRIALING',
            type: 'TRIAL',
            trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias de trial
          },
        })
      }

      return reply.status(201).send({ message: 'User created successfully' })
    },
  )
}

async function getBasicPlanId() {
  const basicPlan = await prisma.plan.findFirst({
    where: { type: 'BASIC' },
    select: { id: true },
  })

  if (!basicPlan) {
    throw new BadRequestError('Basic plan not found in the database.')
  }

  return basicPlan.id
}
