export type FieldError = { field: string; message: string };

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;
  readonly errors: FieldError[] | undefined;

  constructor(
    message: string,
    statusCode: number,
    code: string = 'INTERNAL_ERROR',
    options?: { isOperational?: boolean; errors?: FieldError[] },
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
    this.isOperational = options?.isOperational ?? true;
    this.errors = options?.errors ?? undefined;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

export function createValidationAppError(message: string, errors: FieldError[]): AppError {
  return new AppError(message, 422, 'VALIDATION_ERROR', { errors });
}
