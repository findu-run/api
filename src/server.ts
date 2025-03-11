import { app } from '@/http/app'
import { env } from '@/env'

app.listen({ port: env.PORT, host: '0.0.0.0' }).then(() => {
  const baseHost =
    env.NODE_ENV === 'dev' ? `http://localhost:${env.PORT}` : `${env.HOST}`

  console.log('🚀 HTTP Server is Running:')
  console.log(`- API: ${baseHost}/`)
  console.log(`- Swagger: ${baseHost}/docs`)
})

