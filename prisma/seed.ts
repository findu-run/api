import { PrismaClient, PlanTier } from '@prisma/client'

const prisma = new PrismaClient()

async function seed() {
  const plans: {
    name: string
    price: number
    type: PlanTier
    isTrialAvailable: boolean
    maxOrganizations: number
    maxIps: number
    maxRequests: number
    ipChangeLimit: number
    supportLevel: string
    description: string
  }[] = [
    {
      name: 'Trial',
      price: 0,
      type: PlanTier.TRIAL,
      isTrialAvailable: true,
      maxOrganizations: 1,
      maxIps: 1,
      maxRequests: 5,
      ipChangeLimit: 24,
      supportLevel: 'E-mail',
      description: 'Plano de teste por 7 dias',
    },
    {
      name: 'Pro',
      price: 57480,
      type: PlanTier.BASIC,
      isTrialAvailable: false,
      maxOrganizations: 1,
      maxIps: 1,
      maxRequests: 500_000,
      ipChangeLimit: 0.5, // 30 min
      supportLevel: 'E-mail',
      description:
        'Dashboard completo, múltiplas APIs, controle de IPs, monitoramento 24h',
    },
    {
      name: 'Scale',
      price: 81889,
      type: PlanTier.PROFESSIONAL,
      isTrialAvailable: false,
      maxOrganizations: 1,
      maxIps: 2,
      maxRequests: 2_000_000,
      ipChangeLimit: 0.5, // 30 min
      supportLevel: 'E-mail, WhatsApp',
      description: 'Tudo do Pro + notificações real-time, suporte prioritário',
    },
    {
      name: 'Enterprise',
      price: 146699,
      type: PlanTier.BUSINESS,
      isTrialAvailable: false,
      maxOrganizations: 4,
      maxIps: 4,
      maxRequests: 5_000_000,
      ipChangeLimit: 0.5, // 30 min
      supportLevel: 'E-mail, WhatsApp, Prioritário',
      description:
        'Tudo do Scale + relatórios personalizados, SLA dedicado, IPs dinâmicos sob demanda',
    },
  ]

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { type: plan.type },
      update: {},
      create: plan,
    })
    console.log(`Plano ${plan.name} criado ou atualizado!`)
  }

  await prisma.$disconnect()
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
