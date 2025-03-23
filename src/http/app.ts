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

export const app = fastify().withTypeProvider<ZodTypeProvider>()

app.register(fastifyRawBody, { field: 'rawBody', runFirst: true })

app.register(fastifyCors)

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
app.register(checkRequestLimit)
app.register(updateIpAddress)
app.register(removeIpAddress)

app.register(getCPF)

app.register(getOrganizationMetrics)
app.register(getIpMetrics)

app.register(cancelSubscription)
app.register(generatePaymentLink)
app.register(getBillingDetails)
app.register(getOrganizationBilling)

app.register(getMembers)
app.register(removeMember)
app.register(updateMember)
