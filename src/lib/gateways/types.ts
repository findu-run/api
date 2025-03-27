export type PaymentMethod = 'pix' | 'credit_card'

export interface CreatePaymentParams {
  amount: number
  invoiceId: string
  customer: {
    name: string
    email: string
    document: string
    phone: string
    ip?: string
  }
  postbackUrl: string
  items?: Array<{
    code: string
    name: string
    amount: number
    quantity: number
  }>
  card?: {
    number: string
    holder: string
    expiry: string
    cvv: string
    installments: number
  }
}

export interface CreatePaymentResponse {
  paymentId: string
  url?: string // PIX QR Code ou link de redirecionamento
}

export interface PaymentGateway {
  createPixPayment(params: CreatePaymentParams): Promise<CreatePaymentResponse>
  createCardPayment(params: CreatePaymentParams): Promise<CreatePaymentResponse>
}
