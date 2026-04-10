import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody } from '../../middlewares/validate.js';
import * as userController from './user.controller.js';
import { updateProfileBodySchema } from './user.schema.js';

export const userRouter = Router();

userRouter.get('/me', authenticate, userController.getMeHandler);
userRouter.patch(
  '/me',
  authenticate,
  validateBody(updateProfileBodySchema),
  userController.patchMeHandler,
);
