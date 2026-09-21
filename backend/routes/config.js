import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import {
  getSensitiveFieldsConfig,
  getToolQualityConfig,
  saveSensitiveFieldsConfig,
  saveToolQualityConfig,
} from '../services/scoringConfig.js';

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

// Admin: Get editable tool quality scoring config
router.get('/tool-quality', requireAdmin, (req, res) => {
  try {
    res.json(getToolQualityConfig());
  } catch (error) {
    console.error('Error loading tool quality config:', error);
    res.status(500).json({ error: 'Failed to load tool quality config' });
  }
});

// Admin: Update editable tool quality scoring config
router.put('/tool-quality', requireAdmin, async (req, res) => {
  try {
    const saved = await saveToolQualityConfig(req.body);
    res.json(saved);
  } catch (error) {
    console.error('Error saving tool quality config:', error);
    res.status(400).json({
      error: 'Failed to save tool quality config',
      message: error.message,
    });
  }
});

router.get('/sensitive-fields', requireAdmin, (req, res) => {
  try {
    res.json(getSensitiveFieldsConfig());
  } catch (error) {
    console.error('Error loading sensitive fields config:', error);
    res.status(500).json({ error: 'Failed to load sensitive fields config' });
  }
});

router.put('/sensitive-fields', requireAdmin, async (req, res) => {
  try {
    const saved = await saveSensitiveFieldsConfig(req.body);
    res.json(saved);
  } catch (error) {
    console.error('Error saving sensitive fields config:', error);
    res.status(400).json({
      error: 'Failed to save sensitive fields config',
      message: error.message,
    });
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
        path: 'scaIntegrationLevel', 
        label: 'SCA Integration Level', 
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
        path: 'scaTool', 
        label: 'SCA Tool', 
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
        path: 'secretsScanTool',
        label: 'Secrets Scanning Tool',
        category: 'Security Tools',
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'text'
      },
      {
        path: 'secretsScanIntegrationLevel',
        label: 'Secrets Scanning Integration Level',
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
        path: 'sastIncludesSecrets',
        label: 'SAST includes secrets scanning',
        category: 'Security Tools',
        fieldType: 'boolean',
        allowedOperators: ['equals', 'not_equals'],
        valueType: 'dropdown',
        valueOptions: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }],
        validationRules: {
          description: 'For SAST tools that also detect secrets, so a separate tool is not required.'
        }
      },
      {
        path: 'iacContainerScanTool',
        label: 'IaC / Container Scanning Tool',
        category: 'Security Tools',
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'text'
      },
      {
        path: 'iacContainerScanIntegrationLevel',
        label: 'IaC / Container Integration Level',
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
        path: 'iacContainerScanNA',
        label: 'IaC / Container Not Applicable',
        category: 'Security Tools',
        fieldType: 'boolean',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'dropdown',
        valueOptions: [{ value: true, label: 'Not applicable' }, { value: false, label: 'Applies' }],
        validationRules: {
          description: 'Use as an applies_when check so 4.6.14 reports not_applicable for an application with no IaC or containers, rather than failing it.'
        }
      },
      {
        path: 'lastSecretsScanDate',
        label: 'Last Secrets Scan Date',
        category: 'Security Tools',
        fieldType: 'date',
        allowedOperators: ['exists', 'not_exists', 'gte', 'gt', 'lte', 'lt', 'within_days', 'older_than_days'],
        valueType: 'date',
        validationRules: {
          description: 'Use within_days for a rolling recency window (value = number of days).'
        }
      },
      {
        path: 'lastIacContainerScanDate',
        label: 'Last IaC / Container Scan Date',
        category: 'Security Tools',
        fieldType: 'date',
        allowedOperators: ['exists', 'not_exists', 'gte', 'gt', 'lte', 'lt', 'within_days', 'older_than_days'],
        valueType: 'date',
        validationRules: {
          description: 'Use within_days for a rolling recency window (value = number of days).'
        }
      },
      // Security Tools - Dates (may need cross-field comparisons later)
      { 
        path: 'lastSastScanDate', 
        label: 'Last SAST Scan Date', 
        category: 'Security Tools', 
        fieldType: 'date',
        allowedOperators: ['exists', 'not_exists', 'gte', 'gt', 'lte', 'lt', 'within_days', 'older_than_days'],
        valueType: 'date',
        validationRules: {
          description: 'Use within_days for a rolling recency window (value = number of days, e.g. 30). gte/lte compare against a fixed date, which goes stale.'
        }
      },
      { 
        path: 'lastDastScanDate', 
        label: 'Last DAST Scan Date', 
        category: 'Security Tools', 
        fieldType: 'date',
        allowedOperators: ['exists', 'not_exists', 'gte', 'gt', 'lte', 'lt', 'within_days', 'older_than_days'],
        valueType: 'date',
        validationRules: {
          description: 'Use within_days for a rolling recency window (value = number of days, e.g. 30). gte/lte compare against a fixed date, which goes stale.'
        }
      },
      { 
        path: 'lastScaScanDate', 
        label: 'Last SCA Scan Date', 
        category: 'Security Tools', 
        fieldType: 'date',
        allowedOperators: ['exists', 'not_exists', 'gte', 'gt', 'lte', 'lt', 'within_days', 'older_than_days'],
        valueType: 'date',
        validationRules: {
          description: 'Use within_days for a rolling recency window (value = number of days, e.g. 30). gte/lte compare against a fixed date, which goes stale.'
        }
      },
      
      // Security Tools - Boolean
      { 
        path: 'sastIncludesSca', 
        label: 'SAST includes SCA (SCA same as SAST)', 
        category: 'Security Tools', 
        fieldType: 'boolean',
        allowedOperators: ['equals', 'not_equals'],
        valueType: 'boolean',
        valueOptions: [
          { value: true, label: 'True' },
          { value: false, label: 'False' }
        ]
      },
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
      { 
        path: 'appFirewallNA', 
        label: 'App Firewall Not Applicable', 
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
      
      // Threat Model (relation path — resolved by withEvaluableRelations in services/policy.js)
      {
        path: 'threatModel.status',
        label: 'Threat Model Status',
        category: 'Threat Model',
        fieldType: 'string',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'dropdown',
        valueOptions: [
          { value: 'draft', label: 'Draft' },
          { value: 'in_review', label: 'In Review' },
          { value: 'approved', label: 'Approved' },
          { value: 'superseded', label: 'Superseded' }
        ]
      },
      {
        path: 'threatModel.lastReviewedAt',
        label: 'Threat Model Last Reviewed',
        category: 'Threat Model',
        fieldType: 'date',
        allowedOperators: ['exists', 'not_exists', 'gte', 'gt', 'lte', 'lt', 'within_days', 'older_than_days'],
        valueType: 'date',
        validationRules: {
          description: 'Use within_days for a rolling review window (value = number of days).'
        }
      },

      // Architecture documentation (relations — resolved by withEvaluableRelations).
      // Together these are what 4.6.6 bullet 1 treats as the application's
      // architecture documentation; see POLICY_CONTROL_COVERAGE_PLAN.md Phase 3.
      {
        path: 'apiSchema',
        label: 'API Schema Uploaded',
        category: 'Architecture',
        fieldType: 'relation',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'none'
      },
      {
        path: 'ingressProducts',
        label: 'Product Ingress Points',
        category: 'Architecture',
        fieldType: 'collection',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'none',
        validationRules: {
          description: 'True when the application is recorded as an ingress point for at least one product.'
        }
      },
      {
        path: 'outgoingProductFlows',
        label: 'Outgoing Data Flows',
        category: 'Architecture',
        fieldType: 'collection',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'none'
      },
      {
        path: 'incomingProductFlows',
        label: 'Incoming Data Flows',
        category: 'Architecture',
        fieldType: 'collection',
        allowedOperators: ['exists', 'not_exists'],
        valueType: 'none'
      },

      // Source Control — branch protection on the linked repo's default branch.
      // Read during repo sync; null until a sync has run, which is why
      // branchProtectionEnabled is tri-state rather than a plain boolean.
      {
        path: 'scmRepoLink.repo.requiredApprovingReviewCount',
        label: 'Required Approving Reviews',
        category: 'Source Control',
        fieldType: 'number',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals', 'gte', 'gt', 'lte', 'lt'],
        valueType: 'number',
        validationRules: {
          description: 'Approvals required to merge into the default branch. gte 1 is the usual bar for segregation of duties.'
        }
      },
      {
        path: 'scmRepoLink.repo.branchProtectionEnabled',
        label: 'Branch Protection Enabled',
        category: 'Source Control',
        fieldType: 'boolean',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'dropdown',
        valueOptions: [
          { value: true, label: 'Protected' },
          { value: false, label: 'Not protected' }
        ],
        validationRules: {
          description: 'Null until a repo sync has read it — "unknown" is not the same as "not protected".'
        }
      },
      {
        path: 'scmRepoLink.repo.dismissStaleReviews',
        label: 'Dismiss Stale Reviews',
        category: 'Source Control',
        fieldType: 'boolean',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'dropdown',
        valueOptions: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]
      },
      {
        path: 'scmRepoLink.repo.requireCodeOwnerReviews',
        label: 'Require Code Owner Review',
        category: 'Source Control',
        fieldType: 'boolean',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'dropdown',
        valueOptions: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]
      },
      {
        path: 'scmRepoLink.repo.requiresStatusChecks',
        label: 'Required Status Checks',
        category: 'Source Control',
        fieldType: 'boolean',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'dropdown',
        valueOptions: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]
      },
      {
        path: 'scmRepoLink.repo.enforcedForAdmins',
        label: 'Protection Enforced for Admins',
        category: 'Source Control',
        fieldType: 'boolean',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'dropdown',
        valueOptions: [{ value: true, label: 'Yes' }, { value: false, label: 'No (admins can bypass)' }]
      },
      {
        path: 'scmRepoLink.repo.allowsForcePushes',
        label: 'Allows Force Pushes',
        category: 'Source Control',
        fieldType: 'boolean',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'dropdown',
        valueOptions: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]
      },
      {
        path: 'scmRepoLink.repo.branchProtectionSyncedAt',
        label: 'Branch Protection Last Read',
        category: 'Source Control',
        fieldType: 'date',
        allowedOperators: ['exists', 'not_exists', 'gte', 'gt', 'lte', 'lt', 'within_days', 'older_than_days'],
        valueType: 'date',
        validationRules: {
          description: 'Use within_days to require the evidence itself be recent.'
        }
      },
      {
        path: 'scmRepoLink.repo.prTemplateHasSecuritySection',
        label: 'PR Template Has Security Section',
        category: 'Source Control',
        fieldType: 'boolean',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'dropdown',
        valueOptions: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }],
        validationRules: {
          description: 'The repo has a pull request template containing a security heading or checklist item. Evidence that reviewers are prompted — NOT that any pull request was completed.'
        }
      },
      {
        path: 'scmRepoLink.repo.prTemplateFound',
        label: 'PR Template Present',
        category: 'Source Control',
        fieldType: 'boolean',
        allowedOperators: ['exists', 'not_exists', 'equals', 'not_equals'],
        valueType: 'dropdown',
        valueOptions: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]
      },
      {
        path: 'scmRepoLink.repo.prTemplateSyncedAt',
        label: 'PR Template Last Read',
        category: 'Source Control',
        fieldType: 'date',
        allowedOperators: ['exists', 'not_exists', 'gte', 'gt', 'lte', 'lt', 'within_days', 'older_than_days'],
        valueType: 'date'
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
        path: 'metadataLastReviewed',
        label: 'Metadata Last Reviewed',
        category: 'Status',
        fieldType: 'date',
        allowedOperators: ['exists', 'not_exists', 'gte', 'gt', 'lte', 'lt', 'within_days', 'older_than_days'],
        valueType: 'date',
        validationRules: {
          description: 'For "reviewed at least every six (6) months" use Within the last N days with 183.'
        }
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
