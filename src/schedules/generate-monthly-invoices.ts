import type { FastifyInstance } from 'fastify'
import { CronJob, AsyncTask } from 'toad-scheduler'
import { prisma } from '@/lib/prisma'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'

export async function generateMonthlyInvoices(app: FastifyInstance) {
  const task = new AsyncTask(
    'generate-monthly-invoices',
    async () => {
      const today = convertToBrazilTime(new Date())
      const dueDate = today.add(1, 'month').startOf('month').toDate()

      const activeSubs = await prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: { plan: true },
      })

      for (const sub of activeSubs) {
        await prisma.invoice.create({
          data: {
            organizationId: sub.organizationId,
            subscriptionId: sub.id,
            amount: sub.plan.price,
            dueDate,
            status: 'PENDING',
          },
        })

        app.log.info(`📄 Invoice gerada para org ${sub.organizationId}`)
      }
    },
    (err) => {
      app.log.error('Erro ao gerar invoices mensais:', err)
    },
  )

  const job = new CronJob(
    { cronExpression: '0 6 1 * *', timezone: 'America/Sao_Paulo' }, // Dia 1, 06h
    task,
    { preventOverrun: true },
  )

  app.scheduler.addCronJob(job)
}
