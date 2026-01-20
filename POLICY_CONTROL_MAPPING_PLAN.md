# Policy Control Mapping Feature - Implementation Plan

## Overview
This feature allows mapping security policy controls to application metadata fields via a **database-backed, admin-editable UI**. It provides visibility into policy compliance at the application level. Admins can create, edit, and manage policy controls through a web interface, making it easy to update policy requirements without code changes.

## MVP Requirements

### 1. Database Schema
**Models**: `PolicyControl` and `PolicyControlField` (see `backend/prisma/schema.prisma`)

**PolicyControl Table**:
- `id`: Unique identifier
- `controlId`: Policy control number (e.g., "3.4.2") - unique
- `name`: Display name (e.g., "Pre-Prod Scanning Required")
- `description`: Full description of the requirement
- `category`: Optional category grouping (e.g., "Security Testing")
- `evaluationLogic`: "AND" or "OR" - how to combine field checks
- `isActive`: Whether this control is currently active
- `displayOrder`: Order for display in UI
- `createdAt`, `updatedAt`: Timestamps

**PolicyControlField Table**:
- `id`: Unique identifier
- `controlId`: Foreign key to PolicyControl
- `fieldPath`: Application field to check (e.g., "sastTool", "sastIntegrationLevel", "facing")
- `operator`: Evaluation operator (exists, equals, gte, etc.)
- `value`: JSON string for the value (supports string, number, boolean, array)
- `displayOrder`: Order within the control
- `createdAt`, `updatedAt`: Timestamps

### 2. Configuration Structure (Database Representation)

**Example Control (as stored in database)**:

**PolicyControl Record**:
- controlId: "3.4.2"
- name: "Pre-Prod Scanning Required"
- description: "SAST or DAST scanning must be performed before deployment to a production environment."
- category: "Security Testing"
- evaluationLogic: "OR"
- isActive: true
- displayOrder: 1

**PolicyControlField Records** (for control 3.4.2):
1. fieldPath: "sastTool", operator: "exists", value: null, displayOrder: 1
2. fieldPath: "dastTool", operator: "exists", value: null, displayOrder: 2

**Example: Conditional Control (Firewall for External Apps)**:

**PolicyControl Record**:
- controlId: "4.1.1"
- name: "Application Firewall Required"
- description: "External-facing applications must have an application firewall configured."
- category: "Infrastructure Security"
- evaluationLogic: "OR"  // If Internal OR firewall exists, control is satisfied/N/A
- isActive: true

**PolicyControlField Records**:
1. fieldPath: "facing", operator: "equals", value: "Internal", displayOrder: 1
   // If facing = Internal, control is N/A (satisfied via OR logic)
2. fieldPath: "appFirewallTool", operator: "exists", value: null, displayOrder: 2
   // If firewall exists, control is met

### 2. Field Evaluation Operators
- `exists`: Field has a non-null, non-empty value
- `equals`: Field equals a specific value
- `not_equals`: Field does not equal a value
- `gte`: Field is greater than or equal to value (for numbers)
- `gt`: Field is greater than value (for numbers)
- `lte`: Field is less than or equal to value (for numbers)
- `lt`: Field is less than value (for numbers)
- `contains`: Field contains a substring (for strings)
- `in`: Field value is in an array of values
- `not_in`: Field value is not in an array

### 3. Backend Implementation

#### 3.1 Policy Service (`backend/services/policy.js`)
- Function to evaluate a control against an application
- Function to evaluate all controls for an application
- Field value extraction from application object (supports nested paths for future)
- Return compliance status (meeting/not meeting) with evidence

**Key Functions**:
```javascript
// Get field value from application (supports dot notation for future nested fields)
getFieldValue(application, fieldPath) -> any

// Evaluate a single field check
evaluateFieldCheck(fieldCheck, fieldValue) -> boolean

// Evaluate a single control
async evaluateControl(control, application) -> {
  status: 'meeting' | 'not_meeting',
  evidence: string[],  // Which fields show compliance/non-compliance
  details: {
    fieldResults: Array<{fieldPath, operator, value, result, fieldValue}>,
    evaluationLogic: 'AND' | 'OR',
    finalResult: boolean
  }
}

// Evaluate all active controls for an application
async evaluateAllControls(application) -> {
  controls: Array<{control, status, evidence, details}>,
  summary: {
    total: number,
    meeting: number,
    not_meeting: number,
    compliance_percentage: number
  }
}
```

#### 3.2 API Endpoints

**Policy Controls CRUD** (`backend/routes/policyControls.js` - admin-only):
- `GET /api/policy-controls` - List all controls (with fields)
- `GET /api/policy-controls/:id` - Get single control with fields
- `POST /api/policy-controls` - Create new control (with fields)
- `PUT /api/policy-controls/:id` - Update control (with fields)
- `DELETE /api/policy-controls/:id` - Delete control (cascades to fields)
- `PATCH /api/policy-controls/:id/reorder` - Update display order

**Policy Compliance** (`backend/routes/applications.js`):
- `GET /api/applications/:id/policy-compliance` - Evaluate all controls for application
- Returns compliance status with evidence for each control

**Field Mapping Info** (`backend/routes/config.js`):
- `GET /api/config/available-fields` - Returns list of all mappable application fields
- Used by admin UI to show available fields when creating controls

### 4. Frontend Implementation

#### 4.1 Admin Policy Controls Management Page (`frontend/src/pages/PolicyControls.jsx`)
**New admin-only page** for managing policy controls:
- List all controls with their status (active/inactive)
- Create new control button
- Edit/delete controls
- Drag-and-drop or up/down arrows for reordering
- Form to create/edit control:
  - Control ID (e.g., "3.4.2")
  - Name
  - Description
  - Category (dropdown or free text)
  - Evaluation Logic (AND/OR radio buttons)
  - Active toggle
  - Field mappings section:
    - Add field button
    - For each field: field path (dropdown of available fields), operator (dropdown), value (input), remove button
    - Reorder fields within control

**Available Fields List**: Generated from Application schema, includes:
- Basic: name, description, repoUrl, language, framework, etc.
- Security: sastTool, sastIntegrationLevel, dastTool, dastIntegrationLevel, appFirewallTool, etc.
- Business: businessCriticality, criticalAspects, devTeamContact
- Deployment: currentVersion, deploymentEnvironment, lastDastScanDate, lastSastScanDate
- Future: Could support nested paths like "company.divisionId" (for later)

#### 4.2 Infosec Policy Compliance Tab (`frontend/src/pages/ApplicationDetail.jsx`)
Add new tab "Infosec Policy Compliance" (separate from "Security" tab)

**Display**:
- Summary card showing:
  - Total controls
  - Meeting / Not Meeting / N/A counts
  - Overall compliance percentage
- List of all controls with:
  - Control number and name
  - Status badge (green/yellow/red/gray)
  - Evidence showing which fields indicate compliance
  - Expandable details showing field values

**Example UI**:
```
┌─────────────────────────────────────────┐
│ Security Policy Compliance              │
├─────────────────────────────────────────┤
│ Overall: 75% (6/8 controls meeting)     │
│ ✅ Meeting: 6  ❌ Not Meeting: 2         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 3.4.2 - Pre-Prod Scanning Required      │
│ ✅ Meeting                               │
│ Evidence: SAST tool configured          │
│ [Show Details]                           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 3.4.3 - SAST Integration Level          │
│ ❌ Not Meeting                           │
│ Evidence: SAST integration level is 1    │
│          (requires level 2 or higher)    │
│ [Show Details]                           │
└─────────────────────────────────────────┘
```

#### 4.3 Field Tooltips (`frontend/src/components/ui/Tooltip.jsx`)
Create reusable tooltip component that shows:
- Icon indicator (info icon) next to field label
- On hover: "This field maps to the InfoSec Policy. Filling it out will ensure policy compliance."
- Link to Infosec Policy Compliance tab for full details

**Usage**: Add icon indicator next to any field that has a policy control mapping
- Query which fields have controls on component mount
- Show icon only for fields that have active controls

#### 4.4 Integration with Score Card
**Decision**: Keep scoring separate for MVP
- Policy compliance is shown only in the "Infosec Policy Compliance" tab
- No integration with ScoreCard for now
- Can be added later if needed

### 5. Field Mapping Examples

Based on your sample and the application schema, here are realistic mappings:

```json
{
  "control_id": "3.4.2",
  "control_name": "Pre-Prod Scanning Required",
  "metadata_fields": [
    {"field": "sastTool", "operator": "exists"},
    {"field": "dastTool", "operator": "exists"}
  ],
  "evaluation_logic": "OR"
}

{
  "control_id": "3.4.3",
  "control_name": "SAST Integration Level",
  "metadata_fields": [
    {"field": "sastTool", "operator": "exists"},
    {"field": "sastIntegrationLevel", "operator": "gte", "value": 2}
  ],
  "evaluation_logic": "AND"
}

{
  "control_id": "4.1.1",
  "control_name": "External Apps Require Firewall",
  "metadata_fields": [
    {"field": "facing", "operator": "equals", "value": "Internal"},
    {"field": "appFirewallTool", "operator": "exists"}
  ],
  "evaluation_logic": "OR"  // If Internal, N/A. If External, firewall required.
}

{
  "control_id": "2.1.1",
  "control_name": "Repository URL Required",
  "metadata_fields": [
    {"field": "repoUrl", "operator": "exists"}
  ],
  "evaluation_logic": "AND"
}

{
  "control_id": "2.1.2",
  "control_name": "Development Team Contact Required",
  "metadata_fields": [
    {"field": "devTeamContact", "operator": "exists"}
  ],
  "evaluation_logic": "AND"
}
```

### 6. Deployment Considerations

#### 6.1 Database Storage
- Policy controls stored in PostgreSQL database
- No config file needed - fully managed through admin UI
- Changes take effect immediately (no restart needed)
- Can track history via `createdAt`/`updatedAt` timestamps

#### 6.2 Versioning (Future Enhancement)
- Could add version field to PolicyControl model
- Track which version was used for each evaluation
- Allow multiple policy versions if needed
- For MVP: Single active version

#### 6.3 Performance
- Policy evaluation is lightweight (just field checks)
- Load controls from database on-demand (when viewing application detail page)
- Could cache active controls in memory if needed (future optimization)
- Field mapping queries are simple (indexed on controlId and fieldPath)

### 7. Implementation Phases

#### Phase 1: MVP (Current Request)
1. ✅ Create database schema (PolicyControl, PolicyControlField)
2. ✅ Create Prisma migration
3. ✅ Backend service to evaluate controls
4. ✅ API routes for policy controls CRUD (admin-only)
5. ✅ API endpoint for policy compliance evaluation
6. ✅ Admin UI page for managing policy controls
7. ✅ Infosec Policy Compliance tab on application detail page
8. ✅ Tooltip/icon indicator for fields with controls
9. ✅ Basic compliance display (meeting/not meeting)

#### Phase 2: Enhanced Display
1. Expandable control details
2. Visual indicators (icons, colors)
3. Filtering/sorting controls by status
4. Export compliance report

#### Phase 3: Score Integration
1. Add policy compliance to ScoreCard
2. Calculate compliance percentage
3. Show as separate metric or integrate into existing score

#### Phase 4: Advanced Features
1. Policy versioning
2. Historical compliance tracking
3. Bulk compliance reporting
4. Compliance trends over time
5. Custom control categories

### 8. Technical Decisions (Resolved)

1. **Tooltip Implementation**: 
   - ✅ Icon indicator with hover tooltip
   - ✅ Custom React component
   - ✅ Position: next to field label

2. **Score Integration**:
   - ✅ Separate for MVP (no integration with ScoreCard)
   - ✅ Display only in Infosec Policy Compliance tab

3. **Control Evaluation**:
   - ✅ Real-time evaluation (on-demand when viewing page)
   - ✅ No caching needed for MVP
   - ✅ No stored compliance status (evaluated fresh each time)

4. **UI/UX**:
   - ✅ Tab name: "Infosec Policy Compliance"
   - ✅ Color scheme: Green (meeting) / Red (not meeting)
   - ✅ Expandable sections for control details

### 9. Questions for Discussion (Resolved)

1. Should we support nested conditions (e.g., `(A OR B) AND C`)?
   - ✅ **MVP**: Simple AND/OR logic per control
   - **Future**: Full expression parser if needed

2. How to handle "Not Applicable"?
   - ✅ Use OR logic with conditional fields (e.g., "Internal" OR "firewall exists")
   - If Internal, control is satisfied/N/A via OR logic
   - If External, firewall must exist

3. Should controls be grouped by category?
   - ✅ Yes, for better organization
   - Display in collapsible sections by category

4. Should we track compliance history?
   - ✅ MVP: Current state only (real-time evaluation)
   - **Future**: Historical tracking if needed

5. Should admins be able to override compliance status?
   - ✅ MVP: No, fully automated based on field values
   - **Future**: Manual overrides with notes if needed

6. Field mapping complexity:
   - ✅ MVP: Support all Application model fields
   - ✅ Future: Could support nested paths (e.g., "company.divisionId") if needed
   - ✅ Field path dropdown in admin UI shows all available fields

## Next Steps

1. Review and refine this plan
2. Finalize config file structure
3. Implement backend service
4. Create API endpoints
5. Build frontend components
6. Test with sample data
7. Deploy and iterate
