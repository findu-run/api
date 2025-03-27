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
  private readonly baseUrl = 'https://checkout.mangofy.com.br/api/v1/payment'

  constructor(credentials: MangofyCredentials) {
    this.apiKey = credentials.apiKey
    this.secretKey = credentials.secretKey
  }

  async createPixPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResponse> {
    const response = await axios.post(
      this.baseUrl,
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
        items: params.items?.map((item) => ({
          code: item.code,
          name: item.name,
          amount: item.amount,
          total: item.amount * item.quantity,
        })),
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
    if (!params.card) {
      throw new Error('Card details are required for credit card payment.')
    }

    const response = await axios.post(
      this.baseUrl,
      {
        store_code: this.apiKey,
        payment_method: 'credit_card',
        payment_format: 'regular',
        payment_amount: params.amount,
        postback_url: params.postbackUrl,
        external_code: params.invoiceId,
        installments: params.card.installments || 1,
        customer: {
          name: params.customer.name,
          email: params.customer.email,
          document: params.customer.document,
          phone: params.customer.phone,
          ip: params.customer.ip,
        },
        items: params.items?.map((item) => ({
          code: item.code,
          name: item.name,
          amount: item.amount,
          total: item.amount * item.quantity,
        })),
        card: {
          number: params.card.number,
          holder_name: params.card.holder,
          expiry: params.card.expiry,
          cvv: params.card.cvv,
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
      url: response.data.url, // Pode ser um redirect ou vazio dependendo da resposta
    }
  }
}
