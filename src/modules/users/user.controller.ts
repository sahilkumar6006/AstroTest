import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authenticate.js';
import { sendSuccess } from '../../utils/response.js';
import type { UpdateProfileBody } from './user.schema.js';
import * as userService from './user.service.js';

function authReq(req: Request): AuthenticatedRequest {
  return req as AuthenticatedRequest;
}

export async function getMeHandler(req: Request, res: Response): Promise<void> {
  const { userId } = authReq(req).user;
  const user = await userService.getMe(userId);
  sendSuccess(res, { message: 'Profile retrieved', data: { user } });
}

export async function patchMeHandler(req: Request, res: Response): Promise<void> {
  const { userId } = authReq(req).user;
  const body = req.body as UpdateProfileBody;
  const user = await userService.updateMe(userId, {
    displayName: body.displayName,
  });
  sendSuccess(res, { message: 'Profile updated', data: { user } });
}
