import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiReference } from '@scalar/express-api-reference';
import { requireAuth } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const specPath = path.resolve(__dirname, '../docs/openapi.json');

const router = express.Router();

router.use(requireAuth);

router.get('/openapi.json', (req, res) => {
  res.sendFile(specPath);
});

router.get(
  '/',
  apiReference({
    url: '/api/docs/openapi.json',
    pageTitle: 'AppSec Catalog API Reference',
    theme: 'default',
    withDefaultFonts: true,
  })
);

export default router;
