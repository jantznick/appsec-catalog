import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Public: Get integration levels
router.get('/integration-levels', (req, res) => {
  try {
    const configPath = path.join(__dirname, '../config/scoring/integrationLevels.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const integrationLevels = JSON.parse(configData);
    
    // Convert to array format for Select component
    const options = Object.entries(integrationLevels)
      .filter(([key]) => key !== '//') // Filter out comment
      .map(([key, value]) => ({
        value: key,
        label: value.name,
      }));
    
    res.json(options);
  } catch (error) {
    console.error('Error loading integration levels:', error);
    res.status(500).json({ error: 'Failed to load integration levels' });
  }
});

export default router;

