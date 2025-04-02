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
  payment_code: string
  external_code: string
  payment_method: string
  payment_status: string
  payment_amount: number
  sale_amount: number
  shipping_amount: number
  installments: number
  installment_amount: number
  pix?: {
    pix_link: string
    pix_qrcode_text: string
  }
}

export interface PaymentGateway {
  createPixPayment(params: CreatePaymentParams): Promise<CreatePaymentResponse>
  createCardPayment(params: CreatePaymentParams): Promise<CreatePaymentResponse>
}
