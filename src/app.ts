import cookieParser from 'cookie-parser';
import express from 'express';
import { apiRouter } from './routes/index.js';
import { globalErrorHandler } from './shared/middleware/error.middleware.js';

export const app = express();
app.use(express.json());
app.use(cookieParser());
app.get('/', (_req, res) => {
  res.status(200).send('Hello World');
});
app.use('/api/v1', apiRouter);
app.use(globalErrorHandler);
