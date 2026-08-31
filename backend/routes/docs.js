import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiReference } from '@scalar/express-api-reference';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const specPath = path.resolve(__dirname, '../docs/openapi.json');

const router = express.Router();

// Public, no login required — same as the platform documentation at /docs,
// which links here from every page. Describes the shape of the API (and how
// to authenticate against it with a token); it doesn't grant any access by
// itself, since every documented endpoint still enforces its own auth.
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
