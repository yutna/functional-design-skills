export class HttpError extends Error {
  readonly status: number
  readonly details: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export type Request = {
  readonly params: Readonly<Record<string, string>>
  readonly body: unknown
}

export type Response = { readonly status: number; readonly body: unknown }

export type Handler = (request: Request) => Promise<Response>

export const toResponse = (error: unknown): Response =>
  error instanceof HttpError
    ? {
        status: error.status,
        body: { error: error.message, details: error.details },
      }
    : { status: 500, body: { error: 'internal error' } }
