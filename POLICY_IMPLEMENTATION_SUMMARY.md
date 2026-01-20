# Policy Control Mapping - Implementation Summary

## Key Changes from Original Plan

### ✅ Database-Backed Instead of JSON Config
- **Original**: JSON config file (`backend/config/policy-mapping.json`)
- **New**: Database tables (`PolicyControl` and `PolicyControlField`)
- **Benefit**: Admin-editable UI, no code changes needed to update policies

### ✅ Admin UI for Policy Management
- New admin-only page: `/policy-controls`
- Create, edit, delete, and reorder policy controls
- Form-based interface for adding field mappings
- No need to edit JSON files manually

### ✅ Field Mapping Support
- Supports all Application model fields
- Dropdown in admin UI shows available fields
- Future: Could support nested paths (e.g., `company.divisionId`)

## Database Schema

### PolicyControl Model
```prisma
model PolicyControl {
  id              String              @id @default(cuid())
  controlId       String              @unique // "3.4.2"
  name            String              // "Pre-Prod Scanning Required"
  description     String              // Full description
  category        String?             // "Security Testing"
  evaluationLogic String              @default("AND") // "AND" or "OR"
  isActive        Boolean             @default(true)
  displayOrder    Int                 @default(0)
  fields          PolicyControlField[]
}
```

### PolicyControlField Model
```prisma
model PolicyControlField {
  id              String          @id @default(cuid())
  controlId       String          // FK to PolicyControl
  fieldPath       String          // "sastTool", "sastIntegrationLevel"
  operator        String          // "exists", "equals", "gte", etc.
  value           String?         // JSON string (supports any type)
  displayOrder    Int             @default(0)
}
```

## Example: Pre-Prod Scanning Control

**Control Record**:
- controlId: "3.4.2"
- name: "Pre-Prod Scanning Required"
- description: "SAST or DAST scanning must be performed..."
- evaluationLogic: "OR"
- category: "Security Testing"

**Field Records**:
1. fieldPath: "sastTool", operator: "exists", value: null
2. fieldPath: "dastTool", operator: "exists", value: null

**Evaluation**: If `sastTool` exists OR `dastTool` exists → Control is "meeting"

## Example: Conditional Control (Firewall)

**Control Record**:
- controlId: "4.1.1"
- name: "Application Firewall Required"
- description: "External-facing apps must have firewall"
- evaluationLogic: "OR"

**Field Records**:
1. fieldPath: "facing", operator: "equals", value: "Internal"
2. fieldPath: "appFirewallTool", operator: "exists", value: null

**Evaluation**: 
- If `facing = "Internal"` → Control is satisfied (N/A for internal apps)
- If `facing = "External"` → Must have `appFirewallTool` to meet control
- OR logic handles both cases

## Implementation Checklist

### Backend
- [x] Database schema added to `schema.prisma`
- [ ] Create Prisma migration
- [ ] Policy evaluation service (`backend/services/policy.js`)
- [ ] Policy controls CRUD routes (`backend/routes/policyControls.js`)
- [ ] Policy compliance endpoint (`backend/routes/applications.js`)
- [ ] Available fields endpoint (`backend/routes/config.js`)

### Frontend
- [ ] Admin policy controls page (`frontend/src/pages/PolicyControls.jsx`)
- [ ] Infosec Policy Compliance tab (`frontend/src/pages/ApplicationDetail.jsx`)
- [ ] Policy indicator icon component
- [ ] Add icons to relevant fields in ApplicationDetail
- [ ] API methods in `frontend/src/lib/api.js`

### Testing
- [ ] Test control evaluation logic
- [ ] Test AND/OR evaluation
- [ ] Test conditional controls (Internal/External firewall)
- [ ] Test admin UI CRUD operations
- [ ] Test field mapping dropdown

## Next Steps

1. **Create Migration**: Run `npx prisma migrate dev --name add_policy_controls`
2. **Build Backend Service**: Implement policy evaluation logic
3. **Create API Routes**: CRUD endpoints for policy controls
4. **Build Admin UI**: Policy controls management page
5. **Add Compliance Tab**: Infosec Policy Compliance tab to ApplicationDetail
6. **Add Field Indicators**: Icons on fields with policy controls

## Field Operators Supported

- `exists`: Field has non-null, non-empty value
- `equals`: Field equals value
- `not_equals`: Field does not equal value
- `gte`: Field >= value (numbers)
- `gt`: Field > value (numbers)
- `lte`: Field <= value (numbers)
- `lt`: Field < value (numbers)
- `contains`: Field contains substring (strings)
- `in`: Field value in array
- `not_in`: Field value not in array

## Available Application Fields (for mapping)

**Basic Info**: name, description, repoUrl, owner, language, framework, serverEnvironment

**Security**: sastTool, sastIntegrationLevel, dastTool, dastIntegrationLevel, appFirewallTool, appFirewallIntegrationLevel, apiSecurityTool, apiSecurityIntegrationLevel, apiSecurityNA

**Deployment**: currentVersion, deploymentEnvironment, gitBranch, lastDastScanDate, lastSastScanDate

**Business**: businessCriticality, criticalAspects, devTeamContact

**Other**: facing, deploymentType, authProfiles, dataTypes, securityTestingDescription, additionalNotes, status

**Future**: Could support nested paths like `company.divisionId`, `company.name`, etc.
