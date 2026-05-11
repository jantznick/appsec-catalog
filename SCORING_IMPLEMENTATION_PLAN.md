# Scoring System Implementation Plan

## Overview
Implement an automated scoring system that calculates application security scores based on:
1. **Knowledge Sharing Score (50 points)**: Measures how well application metadata is documented and reviewed
2. **Tool Usage Score (50 points)**: Measures security tool implementation and integration quality
3. **Total Score (100 points)**: Sum of both categories

## Architecture

### Scoring Logic
Based on the reference implementation from `msp-dashboard`, the scoring system uses:
- **Integration Levels**: Weight multipliers (0.0-1.0) for tool integration depth
- **Tool Quality**: Weight multipliers for specific tools (managed > approved unmanaged > other)
- **Risk Factors**: Multipliers based on application facing (Internal/External) and data types (PII, PCI)

## Implementation Phases

### Phase 1: Backend Scoring Service

#### 1.1 Create Scoring Service (`backend/services/scoring.js`)
- **Purpose**: Core scoring calculation logic
- **Functions**:
  - `calculateKnowledgeSharingScore(app)`: Returns 0-50 points
    - Counts filled metadata fields (description, owner, repoUrl, language, framework, serverEnvironment, authProfiles, dataTypes)
    - Awards 40 points for completeness (8 fields × 5 points each)
    - Awards 10 points if `metadataLastReviewed` is within last 6 months
  - `calculateToolUsageScore(app)`: Returns 0-50 points
    - Processes 4 tool categories: SAST, DAST, App Firewall, API Security
    - Base points per category: 12.5 (50 / 4)
    - Applies risk weight multipliers (facing, dataTypes)
    - Applies integration level weights (0.0-1.0)
    - Applies tool quality weights (managed/approvedUnmanaged/other)
    - Handles N/A cases (full points if tool not applicable)
    - Normalizes to 50 points max
  - `calculateApplicationScore(app)`: Main function
    - Calls both sub-functions
    - Returns: `{ knowledgeScore, toolScore, totalScore }`
- **Dependencies**: Load config files at module level
  - `integrationLevels.json`
  - `toolQuality.json`
  - `riskFactors.json`

#### 1.2 Add Score Fields to Application Model
- **Option A (Recommended)**: Calculate on-the-fly (no DB changes)
  - Scores computed when requested
  - Always up-to-date with current data
  - No schema migration needed
- **Option B**: Store calculated scores (requires migration)
  - Add fields: `knowledgeScore`, `toolScore`, `totalScore`, `scoreLastCalculated`
  - Pros: Faster retrieval, can track score history
  - Cons: Requires recalculation when data changes

**Recommendation**: Start with Option A, add Option B later if performance becomes an issue.

#### 1.3 Create Scoring API Endpoints

**GET `/api/applications/:id/score`**
- Public endpoint (authenticated users can see their company's apps, admins see all)
- Returns: `{ knowledgeScore, toolScore, totalScore, breakdown }`
- Breakdown includes:
  - Knowledge sharing: fields filled, review status
  - Tool usage: per-category scores, risk adjustments

**POST `/api/applications/:id/review`** (Admin only)
- Marks metadata as reviewed
- Sets `metadataLastReviewed` to current timestamp
- Recalculates and returns new score
- Body: `{ reviewedBy: string }` (optional, from session)

**GET `/api/applications/:id/score/breakdown`** (Optional, detailed view)
- Detailed breakdown for debugging/transparency
- Shows:
  - Per-field completeness
  - Per-tool category calculation
  - Risk adjustments applied
  - Tool quality multipliers used

### Phase 2: Frontend Display

#### 2.1 Score Display Component (`frontend/src/components/scoring/ScoreCard.jsx`)
- **Purpose**: Reusable score display widget
- **Props**: `knowledgeScore`, `toolScore`, `totalScore`, `breakdown` (optional)
- **Features**:
  - Visual score display (0-100)
  - Color coding: Red (0-50), Yellow (51-75), Green (76-100)
  - Progress bars for each category
  - Breakdown tooltip/expandable section
  - Last reviewed date (if applicable)

#### 2.2 Application Detail Page Integration
- Add score card to `ApplicationDetail.jsx`
- Display above or alongside basic information
- Show breakdown on click/expand
- For admins: Show "Mark as Reviewed" button
  - Opens modal to confirm review
  - Updates `metadataLastReviewed`
  - Refreshes score

#### 2.3 Applications List Page Enhancement
- Add score column to applications table
- Sortable by score
- Color-coded badges (red/yellow/green)
- Quick view of score without navigating to detail

#### 2.4 Dashboard Integration
- Admin dashboard: Show average scores, score distribution
- User dashboard: Show company average, personal application scores

### Phase 3: Score Calculation & Caching

#### 3.1 Score Calculation Strategy
- **On-Demand**: Calculate when requested (initial implementation)
- **On-Update**: Recalculate when application data changes
  - Hook into application update endpoints
  - Store scores if using Option B
- **Scheduled**: Periodic recalculation (future enhancement)
  - Background job to recalculate all scores
  - Useful if risk factors or tool quality configs change

#### 3.2 Caching (Optional, Future)
- Cache scores in memory/Redis
- Invalidate on application updates
- TTL: 1 hour (or until data changes)

### Phase 4: Advanced Features (Future)

#### 4.1 Score History
- Track score changes over time
- Graph score trends
- Identify improving/declining applications

#### 4.2 Score Thresholds & Alerts
- Set minimum score thresholds
- Alert when scores drop below threshold
- Email notifications for admins

#### 4.3 Score Comparison
- Compare application scores within company
- Industry benchmarks
- Best practices recommendations

## Technical Details

### Risk Factor Application
```javascript
// Risk weight starts at 1.0
let riskWeight = 1.0;

// Apply facing multiplier (if External, 1.5x)
if (app.facing === 'External') {
  riskWeight = Math.max(riskWeight, 1.5);
}

// Apply data type multipliers (PII: 1.2x, PCI: 1.5x)
// Use max of all applicable multipliers
```

### Tool Category Mapping
- `sast` → `sastTool`, `sastIntegrationLevel`
- `dast` → `dastTool`, `dastIntegrationLevel`
- `appFirewall` → `appFirewallTool`, `appFirewallIntegrationLevel`
- `apiSecurity` → `apiSecurityTool`, `apiSecurityIntegrationLevel`, `apiSecurityNA`

### N/A Handling
- If `apiSecurityNA === true`, award full category points (12.5 × riskWeight)
- Other tools don't have N/A flags, so missing = 0 points

## API Response Examples

### GET /api/applications/:id/score
```json
{
  "knowledgeScore": 35,
  "toolScore": 42,
  "totalScore": 77,
  "breakdown": {
    "knowledgeSharing": {
      "fieldsFilled": 7,
      "totalFields": 8,
      "completenessScore": 35,
      "reviewScore": 0,
      "lastReviewed": null
    },
    "toolUsage": {
      "categories": [
        {
          "name": "SAST",
          "tool": "Snyk",
          "integrationLevel": 3,
          "basePoints": 12.5,
          "riskWeight": 1.5,
          "integrationWeight": 0.75,
          "toolWeight": 1.2,
          "achievedPoints": 16.875
        }
      ],
      "totalPossible": 62.5,
      "totalAchieved": 42,
      "normalizedScore": 42
    }
  }
}
```

## Testing Strategy

### Unit Tests
- Test scoring service functions with various inputs
- Test edge cases (all fields empty, all tools N/A, etc.)
- Test risk factor calculations
- Test normalization logic

### Integration Tests
- Test API endpoints
- Test score recalculation on update
- Test admin review functionality

### Manual Testing
- Verify scores match expected calculations
- Test with real application data
- Verify UI displays correctly

## Migration Path

1. **Week 1**: Implement scoring service and basic API endpoint
2. **Week 2**: Add frontend score display components
3. **Week 3**: Integrate into application detail and list pages
4. **Week 4**: Add admin review functionality and polish

## Open Questions

1. **Score Storage**: Calculate on-the-fly or store in DB?
   - **Recommendation**: Start on-the-fly, add storage later if needed

2. **Score Updates**: When to recalculate?
   - **Recommendation**: On every application update, plus on-demand via API

3. **Review Workflow**: Who can mark as reviewed?
   - **Recommendation**: Admins only, with optional "reviewedBy" tracking

4. **Score Visibility**: Who can see scores?
   - **Recommendation**: All authenticated users can see their company's scores, admins see all

5. **Historical Tracking**: Do we need score history?
   - **Recommendation**: Phase 4 feature, not critical for MVP

## Dependencies

- Existing config files in `backend/config/scoring/`
- Application model with all required fields
- Authentication/authorization middleware
- Frontend UI components (Card, Progress bars, etc.)

## Success Criteria

- ✅ Scores calculate correctly based on reference implementation
- ✅ Scores update when application data changes
- ✅ Scores display clearly on application detail page
- ✅ Admins can mark metadata as reviewed
- ✅ Score breakdown is transparent and debuggable
- ✅ Performance is acceptable (< 100ms calculation time)

