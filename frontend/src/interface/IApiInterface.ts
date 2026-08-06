export type ApiSuccess<T> = {
  success: true
  data: T
}

export type ApiErrorBody = {
  success: false
  error: {
    message: string
    detail: string
  }
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiErrorBody
