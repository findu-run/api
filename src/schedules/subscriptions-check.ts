import type { FastifyInstance } from 'fastify'
import { CronJob, AsyncTask } from 'toad-scheduler'
import { checkSubscriptionStatus } from '@/services/subscription-service'

export async function subscriptionsCheckSchedule(app: FastifyInstance) {
  const cronExpression = '0 8 * * *'
  const task = new AsyncTask(
    'subscription-check-task',
    async () => {
      app.log.info('🔎 Iniciando verificação diária das assinaturas...')
      await checkSubscriptionStatus(app)
      app.log.info('✅ Verificação diária concluída com sucesso!')
    },
    (err) => {
      app.log.error('🚨 Erro ao verificar assinaturas:', err)
    },
  )

  const job = new CronJob(
    {
      cronExpression,
      timezone: 'America/Sao_Paulo',
    },
    task,
    { preventOverrun: true },
  )

  app.jobsMap.set('subscription-check-task', job)
  app.scheduler.addCronJob(job)
}
