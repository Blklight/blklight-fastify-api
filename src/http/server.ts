import { config } from 'dotenv';
import { buildApp } from '../app';
import { env } from '../config/env';
import { startEmailQueue } from '../features/email/email.service';
import { features } from '../config/features';

config();

async function start() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Server running at http://localhost:${env.PORT}`);
    app.log.info(`API docs available at http://localhost:${env.PORT}/docs`);

    if (features.emailQueue) {
      startEmailQueue();
      app.log.info('Email queue started');
    }

    const enabledFeatures = Object.entries(features)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(', ');
    app.log.info(`Features enabled: ${enabledFeatures || 'none'}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
