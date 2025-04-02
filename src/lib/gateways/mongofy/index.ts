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
    console.log('📤 [Mangofy] Enviando pagamento PIX')

    // Garantir que o CPF tenha 11 dígitos e seja apenas números
    const document = params.customer.document.replace(/\D/g, '')
    if (document.length !== 11) {
      throw new Error('O CPF deve ter exatamente 11 dígitos.')
    }

    // Garantir que o telefone tenha 11 dígitos e seja apenas números
    const phone = params.customer.phone.replace(/\D/g, '')
    if (phone.length !== 11) {
      throw new Error(
        'O telefone deve ter exatamente 11 dígitos (DDD + 9 + número).',
      )
    }

    const payload = {
      store_code: this.apiKey,
      payment_method: 'pix',
      payment_format: 'regular',
      installments: 1,
      payment_amount: params.amount,
      postback_url: params.postbackUrl,
      external_code: params.invoiceId,
      pix: {
        expires_in_days: 3,
      },
      customer: {
        name: params.customer.name,
        email: params.customer.email,
        document: document,
        phone: phone,
        ip: params.customer.ip,
      },
      items: params.items?.map((item) => ({
        code: item.code,
        name: item.name,
        amount: item.amount,
        total: item.amount * item.quantity,
      })),
    }

    console.log('📦 Payload:', payload)

    try {
      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          Authorization: this.secretKey,
          'Store-Code': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })

      console.log('✅ [Mangofy] Resposta recebida:', response.data)

      // Ajustar a validação para os campos reais da Mangofy
      if (
        !response.data ||
        !response.data.payment_code ||
        !response.data.pix?.pix_link
      ) {
        console.error('❌ [Mangofy] Resposta inválida da API:', response.data)
        throw new Error('Resposta inválida da API da Mangofy.')
      }

      return {
        paymentId: response.data.payment_code, // Usar payment_code
        url: response.data.pix.pix_link, // Usar pix.pix_link
      }
    } catch (error: any) {
      console.error(
        '❌ [Mangofy] Erro ao criar pagamento PIX:',
        error.response?.data || error.message,
      )
      const message =
        error.response?.data?.message ||
        error.message ||
        'Erro desconhecido ao gerar link de pagamento.'
      throw new Error(message)
    }
  }

  async createCardPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResponse> {
    if (!params.card) {
      throw new Error('Card details are required for credit card payment.')
    }

    console.log('📤 [Mangofy] Enviando pagamento com cartão')
    console.log('📦 Payload:', {
      store_code: this.apiKey,
      amount: params.amount,
      invoiceId: params.invoiceId,
      customer: params.customer,
      items: params.items,
    })

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
          Authorization: this.secretKey, // Secret Key no Authorization
          'Store-Code': this.apiKey, // API Key no Store-Code
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    )

    console.log('✅ [Mangofy] Resposta recebida:', response.data)

    return {
      paymentId: response.data.code,
      url: response.data.url,
    }
  }
}
