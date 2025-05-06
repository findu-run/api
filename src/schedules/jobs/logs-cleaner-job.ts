import { deleteOldQueryLogs } from '@/services/logs-cleaner'
import type { FastifyInstance } from 'fastify'
import { CronJob, AsyncTask } from 'toad-scheduler'

export async function logsCleanerSchedule(app: FastifyInstance) {
  const task = new AsyncTask(
    'logs-cleaner-task',
    async () => {
      app.log.info('🧽 Iniciando limpeza de query logs antigos...')
      await deleteOldQueryLogs(app)
      app.log.info('✅ Limpeza de query logs concluída com sucesso!')
    },
    (err) => {
      app.log.error('❌ Erro na limpeza de query logs:', err)
    },
  )

  const job = new CronJob(
    {
      cronExpression: '0 4 * * *', // Every day at 04:00 AM
      timezone: 'America/Sao_Paulo',
    },
    task,
    { preventOverrun: true },
  )

  app.jobsMap.set('logs-cleaner-task', job)
  app.scheduler.addCronJob(job)
}
