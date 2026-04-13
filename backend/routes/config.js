import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';

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

// Field metadata for policy / compliance UI (read-only; any authenticated user)
router.get('/available-fields', requireAuth, async (req, res) => {
  try {
    // Load integration levels for dropdown options
    const integrationLevelsPath = path.join(__dirname, '../config/scoring/integrationLevels.json');
    const integrationLevelsData = fs.readFileSync(integrationLevelsPath, 'utf8');
    const integrationLevels = JSON.parse(integrationLevelsData);
    const integrationLevelOptions = Object.entries(integrationLevels)
      .filter(([key]) => key !== '//')
      .map(([key, value]) => ({
        value: parseInt(key),
        label: `${key} - ${value.name}`,
      }))
      .sort((a, b) => a.value - b.value);

    // List of all mappable fields from Application model
    // Organized by category for easier selection in admin UI
    // Field-specific constraints:
    //   - allowedOperators: Array of specific operators (overrides fieldType defaults)
    //   - valueType: 'dropdown' | 'number' | 'date' | 'text' | 'boolean'
    //   - valueOptions: For dropdowns, the options array
    //   - validationRules: Additional validation rules
    const availableFields = [
      // Basic Information
      { 
        path: 'name', 
        label: 'Application Name', 
        category: 'Basic Information', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals', 'contains'],
        valueType: 'text'
      },
      { 
        path: 'description', 
        label: 'Description', 
        category: 'Basic Information', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'contains'],
        valueType: 'text'
      },
      { 
        path: 'repoUrl', 
        label: 'Repository URL', 
        category: 'Basic Information', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'text'
      },
      { 
        path: 'owner', 
        label: 'Owner', 
        category: 'Basic Information', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals', 'contains'],
        valueType: 'text'
      },
      { 
        path: 'devTeamContact', 
        label: 'Development Team Contact', 
        category: 'Basic Information', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'text'
      },
      
      // Technical Stack
      { 
        path: 'language', 
        label: 'Language', 
        category: 'Technical Stack', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals', 'in', 'not_in'],
        valueType: 'text'
      },
      { 
        path: 'framework', 
        label: 'Framework', 
        category: 'Technical Stack', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals', 'contains'],
        valueType: 'text'
      },
      { 
        path: 'serverEnvironment', 
        label: 'Server Environment', 
        category: 'Technical Stack', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'text'
      },
      
      // Deployment
      { 
        path: 'deploymentType', 
        label: 'Deployment Type', 
        category: 'Deployment', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'text'
      },
      { 
        path: 'facing', 
        label: 'Facing (Internal/External)', 
        category: 'Deployment', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'text'
      },
      { 
        path: 'currentVersion', 
        label: 'Current Version', 
        category: 'Deployment', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'text'
      },
      { 
        path: 'deploymentEnvironment', 
        label: 'Deployment Environment', 
        category: 'Deployment', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'text'
      },
      { 
        path: 'gitBranch', 
        label: 'Git Branch', 
        category: 'Deployment', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'text'
      },
      
      // Security Tools - Integration Levels (only >= operators, dropdown values)
      { 
        path: 'sastIntegrationLevel', 
        label: 'SAST Integration Level', 
        category: 'Security Tools', 
        fieldType: 'number',
        allowedOperators: ['gte', 'gt'], // Only greater than or equal, greater than
        valueType: 'dropdown',
        valueOptions: integrationLevelOptions,
        validationRules: {
          description: 'Minimum integration level required (0-4 scale)'
        }
      },
      { 
        path: 'dastIntegrationLevel', 
        label: 'DAST Integration Level', 
        category: 'Security Tools', 
        fieldType: 'number',
        allowedOperators: ['gte', 'gt'],
        valueType: 'dropdown',
        valueOptions: integrationLevelOptions,
        validationRules: {
          description: 'Minimum integration level required (0-4 scale)'
        }
      },
      { 
        path: 'appFirewallIntegrationLevel', 
        label: 'Application Firewall Integration Level', 
        category: 'Security Tools', 
        fieldType: 'number',
        allowedOperators: ['gte', 'gt'],
        valueType: 'dropdown',
        valueOptions: integrationLevelOptions,
        validationRules: {
          description: 'Minimum integration level required (0-4 scale)'
        }
      },
      { 
        path: 'apiSecurityIntegrationLevel', 
        label: 'API Security Integration Level', 
        category: 'Security Tools', 
        fieldType: 'number',
        allowedOperators: ['gte', 'gt'],
        valueType: 'dropdown',
        valueOptions: integrationLevelOptions,
        validationRules: {
          description: 'Minimum integration level required (0-4 scale)'
        }
      },
      
      // Security Tools - Tool Names
      { 
        path: 'sastTool', 
        label: 'SAST Tool', 
        category: 'Security Tools', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'text'
      },
      { 
        path: 'dastTool', 
        label: 'DAST Tool', 
        category: 'Security Tools', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'text'
      },
      { 
        path: 'appFirewallTool', 
        label: 'Application Firewall Tool', 
        category: 'Security Tools', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'text'
      },
      { 
        path: 'apiSecurityTool', 
        label: 'API Security Tool', 
        category: 'Security Tools', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'text'
      },
      
      // Security Tools - Dates (may need cross-field comparisons later)
      { 
        path: 'lastSastScanDate', 
        label: 'Last SAST Scan Date', 
        category: 'Security Tools', 
        fieldType: 'date',
        allowedOperators: ['exists', 'not_exists', 'gte', 'gt', 'lte', 'lt'],
        valueType: 'date',
        validationRules: {
          description: 'Compare against deployment date or relative time (e.g., "1 day ago")'
        }
      },
      { 
        path: 'lastDastScanDate', 
        label: 'Last DAST Scan Date', 
        category: 'Security Tools', 
        fieldType: 'date',
        allowedOperators: ['exists', 'not_exists', 'gte', 'gt', 'lte', 'lt'],
        valueType: 'date',
        validationRules: {
          description: 'Compare against deployment date or relative time (e.g., "1 day ago")'
        }
      },
      
      // Security Tools - Boolean
      { 
        path: 'apiSecurityNA', 
        label: 'API Security Not Applicable', 
        category: 'Security Tools', 
        fieldType: 'boolean',
        allowedOperators: ['equals', 'not_equals'],
        valueType: 'boolean',
        valueOptions: [
          { value: true, label: 'True (N/A)' },
          { value: false, label: 'False (Applicable)' }
        ]
      },
      
      // Business Information
      { 
        path: 'businessCriticality', 
        label: 'Business Criticality', 
        category: 'Business Information', 
        fieldType: 'number',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals', 'gte', 'gt', 'lte', 'lt'],
        valueType: 'number',
        validationRules: {
          min: 1,
          max: 5,
          description: 'Business criticality scale (1-5)'
        }
      },
      { 
        path: 'criticalAspects', 
        label: 'Critical Aspects', 
        category: 'Business Information', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'contains'],
        valueType: 'text'
      },
      
      // Security & Data
      { 
        path: 'authProfiles', 
        label: 'Auth Profiles', 
        category: 'Security & Data', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'contains'],
        valueType: 'text'
      },
      { 
        path: 'dataTypes', 
        label: 'Data Types', 
        category: 'Security & Data', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'contains'],
        valueType: 'text'
      },
      { 
        path: 'securityTestingDescription', 
        label: 'Security Testing Description', 
        category: 'Security & Data', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'contains'],
        valueType: 'text'
      },
      
      // Status
      { 
        path: 'status', 
        label: 'Status', 
        category: 'Status', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'text'
      },
      { 
        path: 'additionalNotes', 
        label: 'Additional Notes', 
        category: 'Status', 
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'text'
      },
    ];
    
    res.json(availableFields);
  } catch (error) {
    console.error('Error loading available fields:', error);
    res.status(500).json({ error: 'Failed to load available fields' });
  }
});

export default router;

