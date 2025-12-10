export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  PDF_SIZE_TOO_LARGE = 'PDF_SIZE_TOO_LARGE',
  PDF_PAGES_TOO_MANY = 'PDF_PAGES_TOO_MANY',
}

export const ErrorMessage = {
  [ErrorType.NETWORK_ERROR]: 'Network error. Please try again.',
  [ErrorType.PDF_SIZE_TOO_LARGE]:
    'The file size exceeds 50MB. Please try another file.',
  [ErrorType.PDF_PAGES_TOO_MANY]:
    'The file exceeds 20 pages. Please try another file.'
}
