import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@/lib/prisma'
import { BadRequestError } from '@/http/_errors/bad-request-error'

export async function restrictByPlanLimits(
  request: FastifyRequest<{
    Params: { slug: string }
  }>,
  reply: FastifyReply,
) {
  const { slug } = request.params

  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      subscription: {
        select: {
          plan: {
            select: {
              maxIps: true,
              maxRequests: true,
            },
          },
        },
      },
    },
  })

  if (!organization || !organization.subscription) {
    throw new BadRequestError('Organization or subscription not found.')
  }

  // Verifica limite de IPs
  const ipCount = await prisma.ipAddress.count({
    where: { organizationId: organization.id },
  })

  if (ipCount > organization.subscription.plan.maxIps) {
    throw new BadRequestError(
      `IP limit exceeded. Current: ${ipCount}, Max: ${organization.subscription.plan.maxIps}`,
    )
  }

  // Verifica limite de requisições no último mês
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const requestCount = await prisma.queryLog.count({
    where: {
      organizationId: organization.id,
      createdAt: { gte: startOfMonth },
    },
  })

  if (requestCount > organization.subscription.plan.maxRequests) {
    throw new BadRequestError(
      `Request limit exceeded. Current: ${requestCount}, Max: ${organization.subscription.plan.maxRequests}`,
    )
  }

  // Adiciona os dados ao request para uso posterior, se necessário
  request.planLimits = {
    ipCount,
    requestCount,
    maxIps: organization.subscription.plan.maxIps,
    maxRequests: organization.subscription.plan.maxRequests,
  }
}

// Declaração para estender o tipo FastifyRequest
declare module 'fastify' {
  interface FastifyRequest {
    planLimits?: {
      ipCount: number
      requestCount: number
      maxIps: number
      maxRequests: number
    }
  }
}

export async function registerRestrictByPlanLimits(app: FastifyInstance) {
  app.addHook('preHandler', restrictByPlanLimits)
}
