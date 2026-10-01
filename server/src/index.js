import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = +process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));

// Serve uploaded citizen photos (in production this would be an S3/MinIO signed URL)
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/media', express.static(uploadDir));

// Tiny request logger
app.use((req, _res, next) => {
  console.info(`${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'pulsegrid-api' }));

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.info(`⚡ PulseGrid API listening on http://localhost:${PORT}/api/v1`);
});

/* Graceful shutdown */
const shutdown = () => {
  console.info('Shutting down…');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
