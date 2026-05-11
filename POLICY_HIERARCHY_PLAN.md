# Policy Hierarchy & Scoping System - Implementation Plan

## Overview
Transform the current standalone policy controls into a scoped policy system. Policies group controls together and define which applications must comply. An application must meet ALL applicable policies (no cascading/priority logic - policies are independent).

## Core Concepts

### 1. **Policies** (New Container)
- A **Policy** is a collection of **Policy Controls**
- Policies have scoping/targeting rules that determine which applications must comply
- Policies are **separate and independent** - an application must meet ALL applicable policies
- No cascading/priority logic - all applicable policies must be satisfied

### 2. **Policy Controls** (Existing, Enhanced)
- Individual compliance checks (already exist)
- **Must belong to a Policy** (no standalone controls)
- Controls inherit the policy's scope

### 3. **Scoping/Targeting Types**

#### a. **Global Policy** (`scope: 'global'`)
- Applies to ALL companies and applications
- Example: "All applications must have basic security tools"

#### b. **Division Policy** (`scope: 'division'`)
- Applies to all companies within specific divisions
- Example: "Healthcare division companies must meet HIPAA requirements"

#### c. **Company Policy** (`scope: 'company'`)
- Applies to specific companies
- Example: "Acme Corp must have enhanced security scanning"

#### d. **Conditional Policy** (`scope: 'conditional'`)
- Applies based on application data/characteristics
- Can combine with other scopes
- Examples:
  - "If application stores PCI data, must meet PCI-DSS controls"
  - "If application is external-facing, must have WAF"
  - "If business criticality >= 4, must have SAST integration level >= 3"

## Database Schema Design

### New Model: `Policy`

```prisma
model Policy {
  id              String          @id @default(cuid())
  name            String          // e.g., "Global Security Baseline", "Healthcare Division Policy"
  description     String?         // Optional description
  scope           String          // 'global', 'division', 'company', 'conditional'
  isActive        Boolean         @default(true)
  displayOrder    Int             @default(0)
  
  // Targeting/Scoping Configuration (stored as JSON for flexibility)
  targetingRules  String?         @db.Text // JSON: { type: 'division', divisionIds: [...] } or { type: 'company', companyIds: [...] } or { type: 'conditional', conditions: [...] }
  
  // Relations
  controls        PolicyControl[] // Controls that belong to this policy
  divisionPolicies DivisionPolicy[] // Many-to-many with divisions
  companyPolicies CompanyPolicy[] // Many-to-many with companies
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  @@index([scope])
  @@index([isActive])
  @@index([displayOrder])
}
```

### Enhanced Model: `PolicyControl`

```prisma
model PolicyControl {
  // ... existing fields ...
  policyId        String          // Required - all controls must belong to a policy
  policy          Policy          @relation(fields: [policyId], references: [id], onDelete: Cascade)
  
  // ... rest of existing fields ...
  
  @@index([policyId])
}
```

### Supporting Models for Many-to-Many Relationships

```prisma
// Division-Policy relationship (many-to-many)
model DivisionPolicy {
  id         String   @id @default(cuid())
  divisionId String
  division   Division @relation(fields: [divisionId], references: [id], onDelete: Cascade)
  policyId   String
  policy     Policy   @relation(fields: [policyId], references: [id], onDelete: Cascade)
  
  @@unique([divisionId, policyId])
  @@index([divisionId])
  @@index([policyId])
}

// Company-Policy relationship (many-to-many)
model CompanyPolicy {
  id        String  @id @default(cuid())
  companyId String
  company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  policyId  String
  policy    Policy  @relation(fields: [policyId], references: [id], onDelete: Cascade)
  
  @@unique([companyId, policyId])
  @@index([companyId])
  @@index([policyId])
}
```

## Targeting Rules Structure (JSON)

### Global Policy
```json
{
  "type": "global"
}
```

### Division Policy
```json
{
  "type": "division",
  "divisionIds": ["div1", "div2"]
}
```

### Company Policy
```json
{
  "type": "company",
  "companyIds": ["comp1", "comp2"]
}
```

### Conditional Policy
```json
{
  "type": "conditional",
  "conditions": [
    {
      "fieldPath": "dataTypes",
      "operator": "contains",
      "value": "PCI"
    },
    {
      "fieldPath": "businessCriticality",
      "operator": "gte",
      "value": 4
    }
  ],
  "logic": "AND" // or "OR" - how to combine conditions
}
```

### Combined Scoping (e.g., Division + Conditional)
```json
{
  "type": "combined",
  "divisionIds": ["healthcare-div"],
  "conditions": [
    {
      "fieldPath": "dataTypes",
      "operator": "contains",
      "value": "PHI"
    }
  ],
  "logic": "AND"
}
```

## Policy Evaluation Logic

### When evaluating compliance for an application:

1. **Determine Applicable Policies:**
   ```javascript
   // Pseudo-code
   applicablePolicies = []
   
   // 1. Global policies (always apply)
   applicablePolicies.push(...globalPolicies)
   
   // 2. Division policies (if company is in a division)
   if (application.company.divisionId) {
     applicablePolicies.push(...divisionPolicies[application.company.divisionId])
   }
   
   // 3. Company policies (if company has specific policies)
   applicablePolicies.push(...companyPolicies[application.companyId])
   
   // 4. Conditional policies (evaluate conditions against application)
   for (conditionalPolicy of conditionalPolicies) {
     if (evaluateConditions(conditionalPolicy.targetingRules.conditions, application)) {
       applicablePolicies.push(conditionalPolicy)
     }
   }
   ```

2. **Collect All Controls:**
   - Get all controls from applicable policies
   - Keep controls grouped by policy (no deduplication needed)
   - Each control is tagged with its policy

3. **Evaluate Controls:**
   - Evaluate each control against the application
   - Tag each result with which policy it came from
   - Calculate compliance per policy

4. **Return Results:**
   - Group by policy for display
   - Show per-policy compliance status
   - Show overall compliance (all policies must be met)
   - Show which policies are applicable and why

## UI/UX Considerations

### Admin UI - Policy Management

1. **Policies List Page** (`/policies`)
   - List all policies with scope, priority, active status
   - Show number of controls in each policy
   - Filter by scope type
   - Create/Edit/Delete policies

2. **Policy Detail/Edit Page**
   - Policy metadata (name, description, scope, priority)
   - Targeting configuration UI:
     - Global: Simple toggle/indicator
     - Division: Multi-select dropdown
     - Company: Multi-select dropdown with search
     - Conditional: Field mapping UI (similar to control fields)
   - List of controls in this policy
   - Add/Remove controls from policy
   - Reorder controls

3. **Policy Control Assignment**
   - When creating/editing a control, allow assigning to a policy
   - Or create standalone control (no policy)
   - Show which policy a control belongs to in the controls list

### User UI - Compliance View

1. **Enhanced Compliance Tab**
   - Show policies that apply to this application
   - Group controls by policy
   - Show why each policy applies:
     - "Global Policy: Applies to all applications"
     - "Healthcare Division Policy: Your company is in the Healthcare division"
     - "PCI-DSS Policy: Your application stores PCI data"
   - Overall compliance status
   - Per-policy compliance status

2. **Policy Indicators**
   - Show which policies apply in application detail view
   - Badge/indicator for each applicable policy

## Implementation Phases

### Phase 1: Database Schema & Backend Foundation
1. Create `Policy` model
2. Create `DivisionPolicy` and `CompanyPolicy` junction tables
3. Add `policyId` to `PolicyControl` (required - all controls must belong to a policy)
4. Create migration
5. Update Prisma client
6. Migration script: Create default "Global Policy" and assign all existing controls to it

### Phase 2: Backend API - Policy CRUD
1. Create `/api/policies` routes (CRUD)
2. Policy targeting rules validation
3. Policy-control relationship management
4. Update existing control endpoints to support policy assignment

### Phase 3: Policy Evaluation Engine
1. Update `evaluateAllControls` to:
   - Determine applicable policies for an application
   - Collect controls from policies
   - Handle deduplication and priority
   - Tag results with policy information
2. Create helper functions for:
   - Evaluating conditional targeting rules
   - Determining applicable policies
   - Merging controls from multiple policies

### Phase 4: Admin UI - Policy Management
1. Create `/policies` page (list)
2. Create policy create/edit modal/page
3. Targeting configuration UI components
4. Policy-control assignment UI
5. Update control management to show policy assignment

### Phase 5: User UI - Enhanced Compliance View
1. Update compliance view to group by policy
2. Show policy applicability information
3. Policy indicators/badges
4. Per-policy compliance status

### Phase 6: Migration
1. Create migration script to:
   - Create a default "Global Policy" 
   - Assign all existing controls to this default policy
2. Update any existing code that assumes standalone controls
3. Documentation updates

## Questions & Considerations

### 1. **Control Deduplication**
- **Decision:** No deduplication - if the same control appears in multiple policies, it will be shown once per policy
- Each policy is independent, so controls are evaluated separately per policy

### 2. **Priority/Override Logic**
- **Decision:** Not applicable - policies don't cascade or override each other
- All applicable policies must be satisfied independently

### 3. **Standalone Controls**
- **Decision:** Not supported - all controls must belong to a policy
- Simpler implementation, cleaner data model

### 4. **Policy Inheritance**
- **Decision:** Not in MVP
- May consider for future if cascading is needed

### 5. **Policy Versioning**
- **Decision:** Not in MVP
- May consider for audit trail in future

### 6. **Conditional Logic Complexity**
- **Decision:** Start simple - AND/OR of field checks
- Can expand later if needed

### 7. **Performance**
- Evaluating conditional policies for every application could be expensive
- **Recommendation:** Cache policy applicability, invalidate on policy/application changes

## Example Use Cases

### Use Case 1: Global Baseline
- **Policy:** "Global Security Baseline"
- **Scope:** Global
- **Controls:** 
  - SAST tool must exist
  - DAST tool must exist
- **Applies to:** All applications
- **Result:** All applications must meet this policy

### Use Case 2: Healthcare Division
- **Policy:** "HIPAA Compliance Policy"
- **Scope:** Division (Healthcare)
- **Controls:**
  - Encryption at rest required
  - Access logging required
  - PHI data handling controls
- **Applies to:** All applications in Healthcare division companies
- **Result:** Healthcare applications must meet BOTH Global Baseline AND HIPAA Compliance

### Use Case 3: PCI Data Handling
- **Policy:** "PCI-DSS Requirements"
- **Scope:** Conditional
- **Conditions:** `dataTypes contains "PCI"`
- **Controls:**
  - PCI scanning required
  - Enhanced access controls
  - Quarterly security reviews
- **Applies to:** Applications that store PCI data (regardless of company/division)
- **Result:** PCI applications must meet Global Baseline AND PCI-DSS Requirements (and any other applicable policies)

### Use Case 4: High-Criticality Applications
- **Policy:** "Critical Application Security"
- **Scope:** Conditional
- **Conditions:** `businessCriticality >= 4`
- **Controls:**
  - SAST integration level >= 3
  - DAST integration level >= 3
  - Monthly security reviews
- **Applies to:** Applications with business criticality 4 or 5
- **Result:** Critical applications must meet Global Baseline AND Critical Application Security

### Use Case 5: Company-Specific Requirements
- **Policy:** "Acme Corp Enhanced Security"
- **Scope:** Company (Acme Corp)
- **Controls:**
  - Custom security tool required
  - Specific compliance framework
- **Applies to:** Only Acme Corp applications
- **Result:** Acme Corp applications must meet Global Baseline AND Acme Corp Enhanced Security (and any other applicable policies)

## Next Steps

1. **Review this plan** - Discuss and refine
2. **Finalize schema design** - Confirm field names, relationships
3. **Create detailed API spec** - Endpoints, request/response formats
4. **Design UI mockups** - Policy management interface
5. **Begin Phase 1 implementation** - Database schema and migration
