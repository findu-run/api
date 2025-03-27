import 'fastify'

declare module 'fastify' {
  export interface FastifyRequest {
    getCurrentUserId(): Promise<string>
    getUserSubscription(): Promise<string>
    checkBilling(organizationId: string): Promise<void>
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    scheduler: ToadScheduler
    jobsMap: Map<string, CronJob>
  }
}
