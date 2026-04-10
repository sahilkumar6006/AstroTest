import type { Response } from 'express';

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type SuccessPayload<T> = {
  message: string;
  data?: T;
  status?: number;
  meta?: PaginationMeta;
};

export function sendSuccess<T>(res: Response, payload: SuccessPayload<T>): void {
  const { message, data, status = 200, meta } = payload;
  const body: Record<string, unknown> = {
    success: true,
    message,
  };
  if (data !== undefined) {
    body.data = data;
  }
  if (meta !== undefined) {
    body.meta = meta;
  }
  res.status(status).json(body);
}
