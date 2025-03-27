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
        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            organizationId: sub.organizationId,
            dueDate,
          },
        })

        if (existingInvoice) {
          app.log.info(
            `📄 Invoice já existe para org ${sub.organizationId}, pulando...`,
          )
          continue
        }

        const addons = await prisma.addon.findMany({
          where: { organizationId: sub.organizationId },
          select: { price: true },
        })
        const addonTotal = addons.reduce((sum, addon) => sum + addon.price, 0)
        const totalAmount = sub.plan.price + addonTotal

        await prisma.invoice.create({
          data: {
            organizationId: sub.organizationId,
            subscriptionId: sub.id,
            amount: totalAmount,
            dueDate,
            status: 'PENDING',
          },
        })

        await prisma.subscription.update({
          where: { id: sub.id },
          data: { currentPeriodEnd: dueDate },
        })

        app.log.info(
          `📄 Invoice gerada para org ${sub.organizationId} com total ${totalAmount}`,
        )
      }
    },
    (err) => {
      app.log.error('Erro ao gerar invoices mensais:', err)
    },
  )

  const job = new CronJob(
    { cronExpression: '0 6 1 * *', timezone: 'America/Sao_Paulo' },
    task,
    { preventOverrun: true },
  )

  app.jobsMap.set('generate-monthly-invoices', job)
  app.scheduler.addCronJob(job)
}
