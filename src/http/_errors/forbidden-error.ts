export class ForbiddenError extends Error {
  statusCode = 403

  constructor(message = 'Você não tem permissão para acessar este recurso.') {
    super(message)
    this.name = 'ForbiddenError'
  }
}
