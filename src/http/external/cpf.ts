import { env } from '@/env'
import axios from 'axios'
import { BadRequestError } from '../_errors/bad-request-error'
import { delay } from '@/utils/delay'

export interface CpfDataResponse {
  cpf: string
  name: string
  birthDate: string
  motherName: string
  gender: string
}

export async function getCpfApiMetrics(cpf: string): Promise<CpfDataResponse> {
  try {
    await delay(2000)
    const response = await axios.get(`${env.API_CONSULT}?cpf=${cpf}`)

    return {
      cpf: response.data.CPF,
      name: response.data.NOME,
      birthDate: response.data.NASCIMENTO,
      motherName: response.data.MAE,
      gender: response.data.SEXO,
    }
  } catch (error) {
    console.error('Error fetching data from external API:', error)
    throw new BadRequestError('Failed to fetch CPF data.')
  }
}
