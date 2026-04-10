import { Router } from 'express';
import { validateBody } from '../../middlewares/validate.js';
import * as authController from './auth.controller.js';
import { sendOtpBodySchema, verifyOtpBodySchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/send-otp', validateBody(sendOtpBodySchema), authController.sendOtpHandler);
authRouter.post('/verify-otp', validateBody(verifyOtpBodySchema), authController.verifyOtpHandler);
authRouter.post('/refresh', authController.refreshHandler);
authRouter.post('/logout', authController.logoutHandler);
