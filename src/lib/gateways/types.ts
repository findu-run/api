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
}

export interface CreatePaymentResponse {
  paymentId: string
  url?: string // PIX QR Code ou redirecionamento
}

export interface PaymentGateway {
  createPixPayment(params: CreatePaymentParams): Promise<CreatePaymentResponse>
  createCardPayment(params: CreatePaymentParams): Promise<CreatePaymentResponse>
}
