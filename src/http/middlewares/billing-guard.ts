import type { FastifyInstance, FastifyRequest } from 'fastify'
import { fastifyPlugin } from 'fastify-plugin'
import { prisma } from '@/lib/prisma'
import { ForbiddenError } from '@/http/_errors/forbidden-error'
import dayjs from 'dayjs'

export const billingGuard = fastifyPlugin(async (app: FastifyInstance) => {
  app.decorateRequest(
    'checkBilling',
    async function (this: FastifyRequest, organizationId: string) {
      const today = dayjs().startOf('day').toDate()

      const overdue = await prisma.invoice.findFirst({
        where: {
          organizationId,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lt: today },
        },
      })

      if (overdue) {
        throw new ForbiddenError('A fatura da organização está vencida.')
      }
    },
  )
})
