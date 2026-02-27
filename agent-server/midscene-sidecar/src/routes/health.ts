import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    model: process.env.MIDSCENE_MODEL_NAME || 'unknown',
    proxy: process.env.MIDSCENE_MODEL_HTTP_PROXY || 'none',
    timestamp: new Date().toISOString(),
  });
});
