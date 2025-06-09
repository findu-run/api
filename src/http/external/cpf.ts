// Arquivo: src/http/external/cpf.ts (Modificado com todas as correções)
import { env } from '@/env'
import axios, { AxiosError } from 'axios'
import { BadRequestError } from '../_errors/bad-request-error'

export interface CpfDataResponse {
  cpf: string
  name: string
  birthDate: string
  motherName: string
  gender: string
  sourceApi?: 'primary' | 'secondary' // Indica qual API forneceu a resposta
}

// Definição das APIs e seu estado
const apiConfigs = [
  {
    name: 'primary' as 'primary' | 'secondary',
    getUrl: () => env.API_CONSULT,
    paramKey: 'CPF',
    // getApiKey: () => env.API_CPF_PRIMARY_KEY, // Se houver chave de API
    healthy: true,
    consecutiveFails: 0,
  },
  {
    name: 'secondary' as 'primary' | 'secondary',
    getUrl: () => env.API_CPF_SECONDARY_URL,
    paramKey: 'cpf',
    // getApiKey: () => env.API_CPF_SECONDARY_KEY, // Se houver chave de API
    healthy: true,
    consecutiveFails: 0,
  },
]

let nextApiIndex = 0 // Para o Round Robin
const MAX_CONSECUTIVE_FAILS = 3
const API_RETRY_DELAY_MS = 500 // Pequeno delay antes de tentar API de failover
const API_UNHEALTHY_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutos para API voltar a ser testada

// Métricas em memória (exemplo)
interface ApiMetricsData {
  requests_total: number
  requests_successful: number
  requests_failed: number
  response_time_ms_sum: number
  last_error_timestamp?: number
  last_error_message?: string
}

export const apiMetrics: Record<
  'primary' | 'secondary' | 'overall',
  ApiMetricsData & { average_response_time_ms?: number }
> = {
  primary: {
    requests_total: 0,
    requests_successful: 0,
    requests_failed: 0,
    response_time_ms_sum: 0,
  },
  secondary: {
    requests_total: 0,
    requests_successful: 0,
    requests_failed: 0,
    response_time_ms_sum: 0,
  },
  overall: {
    requests_total: 0,
    requests_successful: 0,
    requests_failed: 0,
    response_time_ms_sum: 0,
  },
}

function updateMetrics(
  apiName: 'primary' | 'secondary',
  isSuccess: boolean,
  latency: number,
  error?: Error,
) {
  apiMetrics[apiName].requests_total++
  apiMetrics.overall.requests_total++

  if (isSuccess) {
    apiMetrics[apiName].requests_successful++
    apiMetrics[apiName].response_time_ms_sum += latency
    apiMetrics.overall.requests_successful++
    apiMetrics.overall.response_time_ms_sum += latency
  } else {
    apiMetrics[apiName].requests_failed++
    apiMetrics.overall.requests_failed++
    apiMetrics[apiName].last_error_timestamp = Date.now()
    apiMetrics[apiName].last_error_message = error?.message || 'Unknown error'
  }
}

async function executeApiCall(
  apiConfig: (typeof apiConfigs)[0],
  cpf: string,
): Promise<CpfDataResponse> {
  const startTime = Date.now()
  let apiUrl = apiConfig.getUrl() // Use let para permitir modificação

  if (!apiUrl) {
    throw new Error(`URL for API ${apiConfig.name} is not configured.`)
  }

  const paramKey = apiConfig.paramKey || 'cpf'
  if (apiUrl.includes('?')) {
    apiUrl = `${apiUrl}&${paramKey}=${cpf}`
  } else {
    apiUrl = `${apiUrl}?${paramKey}=${cpf}`
  }
  

  try {
    // console.log(`[CPF Service] Attempting API: ${apiConfig.name} with final URL: ${apiUrl}`); // Log para depuração
    const response = await axios.get(apiUrl, {
      // Usa a apiUrl modificada
      timeout: 5000, // Timeout de 5 segundos para a requisição
      // headers: { Authorization: `Bearer ${apiConfig.getApiKey()}` } // Exemplo se API Key for necessária
    })
    const latency = Date.now() - startTime
    updateMetrics(apiConfig.name, true, latency)
    apiConfig.consecutiveFails = 0
    if (!apiConfig.healthy) {
      console.log(`[CPF Service] API ${apiConfig.name} is now HEALTHY.`)
      apiConfig.healthy = true
    }

    // Ajuste para lidar com diferentes capitalizações de campos
    const responseData = response.data
    return {
      cpf: responseData.CPF || responseData.cpf, // Tenta CPF, depois cpf
      name: responseData.NOME || responseData.nome,
      birthDate: responseData.NASCIMENTO || responseData.nascimento,
      motherName: responseData.MAE || responseData.mae || '',
      gender: responseData.SEXO || responseData.sexo,
      sourceApi: apiConfig.name,
    }
  } catch (error) {
    const latency = Date.now() - startTime
    updateMetrics(apiConfig.name, false, latency, error as Error)
    apiConfig.consecutiveFails++
    if (
      apiConfig.consecutiveFails >= MAX_CONSECUTIVE_FAILS &&
      apiConfig.healthy
    ) {
      apiConfig.healthy = false
      console.warn(
        `[CPF Service] API ${apiConfig.name} marked as UNHEALTHY after ${apiConfig.consecutiveFails} consecutive failures. Error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      )
      // Inicia cooldown para tentar reativar a API
      setTimeout(() => {
        apiConfig.healthy = true
        apiConfig.consecutiveFails = 0 // Reseta contador para permitir nova tentativa
        console.log(
          `[CPF Service] API ${apiConfig.name} cooldown finished. Marked as HEALTHY for next attempt.`,
        )
      }, API_UNHEALTHY_COOLDOWN_MS)
    }
    throw error // Re-lançar para que a lógica de failover possa tratar
  }
}

export async function fetchCPFData(cpf: string): Promise<CpfDataResponse> {
  const availableApis = apiConfigs.filter((api) => api.healthy && api.getUrl())

  if (availableApis.length === 0) {
    const primaryApi = apiConfigs.find((api) => api.name === 'primary')
    if (primaryApi?.getUrl()) {
      console.warn(
        '[CPF Service] All APIs were unhealthy or unconfigured. Attempting to use primary API as a last resort.',
      )
      if (!primaryApi.healthy) {
        primaryApi.healthy = true
        primaryApi.consecutiveFails = 0
      }
      try {
        return await executeApiCall(primaryApi, cpf)
      } catch (error) {
        console.error(
          '[CPF Service] Primary API also failed after attempting revival as last resort.',
        )
        throw new BadRequestError(
          'All CPF consultation services are currently unavailable.',
        )
      }
    } else {
      console.error(
        '[CPF Service] No CPF consultation services are configured.',
      )
      throw new BadRequestError(
        'No CPF consultation services are configured or available.',
      )
    }
  }

  const initialIndex = nextApiIndex % availableApis.length
  for (let i = 0; i < availableApis.length; i++) {
    const currentIndex = (initialIndex + i) % availableApis.length
    const selectedApi = availableApis[currentIndex]

    if (i === 0) {
      nextApiIndex =
        (apiConfigs.findIndex((api) => api.name === selectedApi.name) + 1) %
        apiConfigs.length
    }

    try {
      return await executeApiCall(selectedApi, cpf)
    } catch (error) {
      console.warn(
        `[CPF Service] API ${selectedApi.name} failed for CPF ${cpf}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
      if (i < availableApis.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, API_RETRY_DELAY_MS))
      }
    }
  }

  console.error(
    '[CPF Service] Failed to fetch CPF data from all available sources after retries.',
  )
  throw new BadRequestError(
    'Failed to fetch CPF data from all available sources after retries.',
  )
}

export function getCpfApiMetrics() {
  const metricsCopy = JSON.parse(JSON.stringify(apiMetrics))
  for (const key of ['primary', 'secondary', 'overall'] as const) {
    if (metricsCopy[key].requests_successful > 0) {
      metricsCopy[key].average_response_time_ms = Number.parseFloat(
        (
          metricsCopy[key].response_time_ms_sum /
          metricsCopy[key].requests_successful
        ).toFixed(2),
      )
    }
  }
  return metricsCopy
}
