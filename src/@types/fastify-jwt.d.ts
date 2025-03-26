import 'fastify'

declare module 'fastify' {
  export interface FastifyRequest {
    getCurrentUserId(): Promise<string>
    getUserSubscription(): Promise<string>
    checkBilling(organizationId: string): Promise<void>
  }
}
