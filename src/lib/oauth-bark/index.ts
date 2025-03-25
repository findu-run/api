import { NotFoundError } from '@/http/_errors/not-found-error'
import axios from 'axios'

interface BarkRegisterResponse {
  code: number
  message: string
  data: {
    key: string
    device_key: string
    device_token: string
  }
  timestamp: number
}

export interface RegisterBarkKeyRequest {
  deviceToken: string
}

export interface BarkDeviceData {
  key: string
  device_key: string
  device_token: string
}

export async function registerBarkKey({
  deviceToken,
}: RegisterBarkKeyRequest): Promise<BarkDeviceData> {
  const registerUrl = `https://bark.findu.run/register?deviceToken=${deviceToken}`

  try {
    const response = await axios.get<BarkRegisterResponse>(registerUrl)
    const { data } = response.data

    if (!response) {
      throw new NotFoundError('Device key not returned from Bark')
    }

    return data
  } catch (err) {
    console.error(err)
    throw new Error('Falha ao registrar device no Bark')
  }
}
