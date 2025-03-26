import type {
  PaymentGateway,
  CreatePaymentParams,
  CreatePaymentResponse,
} from '../types'
import axios from 'axios'

interface MangofyCredentials {
  apiKey: string
  secretKey: string
}

export class MangofyGateway implements PaymentGateway {
  private readonly apiKey: string
  private readonly secretKey: string

  constructor(credentials: MangofyCredentials) {
    this.apiKey = credentials.apiKey
    this.secretKey = credentials.secretKey
  }

  async createPixPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResponse> {
    const response = await axios.post(
      'https://checkout.mangofy.com.br/api/v1/payment',
      {
        store_code: this.apiKey,
        payment_method: 'pix',
        payment_format: 'regular',
        payment_amount: params.amount,
        postback_url: params.postbackUrl,
        external_code: params.invoiceId,
        pix: {
          expires_in_days: 3,
        },
        customer: {
          name: params.customer.name,
          email: params.customer.email,
          document: params.customer.document,
          phone: params.customer.phone,
          ip: params.customer.ip,
        },
      },
      {
        headers: {
          Authorization: this.secretKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    )

    return {
      paymentId: response.data.code,
      url: response.data.url, // QR Code ou link de pagamento
    }
  }

  async createCardPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResponse> {
    // (🟡 A ser implementado em seguida)
    throw new Error('createCardPayment not implemented yet')
  }
}
