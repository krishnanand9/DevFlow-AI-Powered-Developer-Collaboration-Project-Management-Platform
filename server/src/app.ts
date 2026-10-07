import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env } from './config/env';
import { errorHandler } from './middleware/error';
import ai from './routes/ai';
import analytics from './routes/analytics';
import auth from './routes/auth';
import chat from './routes/chat';
import notifications from './routes/notifications';
import projects from './routes/projects';
import sprints from './routes/sprints';
import tasks from './routes/tasks';
import workspaces from './routes/workspaces';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('tiny'));

  app.get('/health', (_req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 }));

  const v1 = express.Router();
  v1.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: process.env.NODE_ENV === 'test' ? 10000 : 100 }));
  v1.use('/auth', auth);
  v1.use('/ai', rateLimit({ windowMs: 60 * 1000, limit: 20 }));
  for (const router of [workspaces, projects, tasks, sprints, analytics, notifications, chat, ai]) v1.use(router);
  app.use('/api/v1', v1);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return app;
}
