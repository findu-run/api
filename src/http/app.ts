import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import fastify from 'fastify'
import { errorHandler } from '@/http/middlewares/error-handler'
import fastifyRawBody from 'fastify-raw-body'
import { env } from '@/env'
import { authenticateWithPassword } from './routes/auth/authenticate-with-password'
import { createAccount } from './routes/auth/create-account'
import { getProfile } from './routes/auth/get-profile'
import { createOrganization } from './routes/organization/create-organization'
import { addIpAddress } from './routes/organization/add-ip'
import { getOrganizations } from './routes/organization/get-organizations'
import { getCPF } from './routes/consult/get-cpf'
import { getOrganization } from './routes/organization/get-organization'
import { removeIpAddress } from './routes/organization/remove-ip'
import { updateIpAddress } from './routes/organization/update-ip'
import { transferOrganization } from './routes/organization/transfer-organization'
import { shutdownOrganization } from './routes/organization/shutdown-organization'
import { getOrganizationLogs } from './routes/organization/get-organization-logs'
import { getOrganizationMetrics } from './routes/metrics/get-organization-metrics'
import { cancelSubscription } from './routes/billing/cancel-subscription'
import { generatePaymentLink } from './routes/billing/generate-payment-link'
import { getBillingDetails } from './routes/billing/get-billing-details'
import { getOrganizationBilling } from './routes/billing/get-organization-billing'
import { checkRequestLimit } from './routes/organization/check-request-limit'
import { getIpMetrics } from './routes/metrics/by-ip'
import { updateMember } from './routes/members/update-member'
import { getMembers } from './routes/members/get-members'
import { removeMember } from './routes/members/remove-member'
import { getMembership } from './routes/organization/get-membership'
import { acceptInvite } from './routes/invites/accept-invite'
import { createInvite } from './routes/invites/create-invites'
import { getInvite } from './routes/invites/get-invite'
import { getInvites } from './routes/invites/get-invites'
import { getPendingInvites } from './routes/invites/get-pending-invites'
import { rejectInvite } from './routes/invites/reject-invite'
import { revokeInvite } from './routes/invites/revoke-invite'
import { healthChecker } from './routes/health/health-checker'

import { updateUserBarkKey } from './routes/integrations/notifications/bark/update-bark-key'
import { connectBark } from './routes/integrations/notifications/bark/connect'
import { fastifySchedule } from '@fastify/schedule'

import { registerBark } from './routes/integrations/notifications/bark/register'
import { testNotificationRoute } from './routes/notifications/test'
import { uptimeWebhook } from './routes/webhooks/uptime-webhook'
import { testTrialFlow } from './routes/health/testTrialFlow'
import { generateMonthlyInvoices } from '@/schedules/generate-monthly-invoices'
import { subscriptionsCheckSchedule } from '@/schedules/subscriptions-check'
import { getJobsStatus } from './routes/health/getJobsStatus'
import { ToadScheduler, type CronJob } from 'toad-scheduler'
import { getInstabilityMetrics } from './routes/metrics/get-instability-metrics'
import { getBarkConnectionStatus } from './routes/integrations/notifications/bark/get-bark-connection-status'
import { getOrganizationIps } from './routes/organization/get-organization-ips'
import { getInvoices } from './routes/billing/invoice/get-invoices'
import { getAvailablePlans } from './routes/billing/get-available-plans'
import { getBillingSummary } from './routes/billing/get-billing-summary'
import { sendFunnyOrCustomNotificationRoute } from './routes/notifications/custom'
import { paymentWebhookRoute } from './routes/webhooks/payments/payments'
import { getOrganizationSummary } from './routes/metrics/get-organization-summary'

export const app = fastify().withTypeProvider<ZodTypeProvider>()

app.register(fastifyRawBody, { field: 'rawBody', runFirst: true })

app.register(fastifyCors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})

app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
})
app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Next.js SaaS',
      description: 'Full-stack SaaS with multi-tenant & RBAC.',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  transform: jsonSchemaTransform,
})

app.register(fastifySwaggerUi, {
  routePrefix: '/docs',
})

app.setSerializerCompiler(serializerCompiler)
app.setValidatorCompiler(validatorCompiler)
app.setErrorHandler(errorHandler)

app.jobsMap = new Map<string, CronJob>()

app.register(fastifySchedule)
app.register(getJobsStatus)
app.register(generateMonthlyInvoices)
app.register(subscriptionsCheckSchedule)
app.register(logsCleanerSchedule)

app.register(healthChecker)
app.register(sendFunnyOrCustomNotificationRoute)
app.register(testNotificationRoute)
app.register(testTrialFlow)
app.register(uptimeWebhook)
app.register(paymentWebhookRoute)

app.register(updateUserBarkKey)
app.register(registerBark)
app.register(connectBark)
app.register(getBarkConnectionStatus)

app.register(createAccount)
app.register(authenticateWithPassword)
app.register(getProfile)

app.register(createOrganization)
app.register(getOrganizations)
app.register(getOrganization)
app.register(transferOrganization)
app.register(getMembership)
app.register(shutdownOrganization)
app.register(getOrganizationLogs)

app.register(addIpAddress)
app.register(getOrganizationIps)
app.register(checkRequestLimit)
app.register(updateIpAddress)
app.register(removeIpAddress)

app.register(getCPF)

app.register(getOrganizationMetrics)
app.register(getIpMetrics)
app.register(getInstabilityMetrics)
app.register(getOrganizationSummary)

app.register(cancelSubscription)
app.register(generatePaymentLink)
app.register(getBillingDetails)
app.register(getBillingSummary)
app.register(getOrganizationBilling)

app.register(getInvoices)
app.register(getAvailablePlans)

app.register(getMembers)
app.register(removeMember)
app.register(updateMember)

app.register(acceptInvite)
app.register(createInvite)
app.register(getInvite)
app.register(getInvites)
app.register(getPendingInvites)
app.register(rejectInvite)
app.register(revokeInvite)
