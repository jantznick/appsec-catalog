# AppSec Catalog - TODO List

This document breaks down all the work needed to build the AppSec Catalog application into small, manageable tasks.

## 🔐 Authentication & User Management

### Backend
- [ ] **AUTH-1**: Set up Express session middleware with cookie-based sessions
- [ ] **AUTH-2**: Create password hashing utility (bcrypt)
- [ ] **AUTH-3**: Create user registration API endpoint (`POST /api/auth/register`)
  - Validate email format
  - Check if email already exists
  - Hash password before storing
  - Extract domain from email
  - Find company by domain match
  - Create user with `verifiedAccount: false` and assigned company (if domain matches)
  - If no company match, create user without company (admin can assign later)
- [ ] **AUTH-4**: Create password login API endpoint (`POST /api/auth/login`)
  - Verify email exists
  - Verify password hash matches
  - Create session
  - Return user data (without password)
- [ ] **AUTH-5**: Create magic code generation utility
  - Generate random code (6 characters)
  - Set expiration (e.g., 15 minutes)
  - Store in MagicCode table
- [ ] **AUTH-6**: Create magic code login API endpoint (`POST /api/auth/login-magic`)
  - Validate code exists and not expired
  - Check if code already used
  - Mark code as used
  - Create session
  - Return user data
- [ ] **AUTH-7**: Create magic code request endpoint (`POST /api/auth/request-magic-code`)
  - Find user by email
  - Generate and store magic code
  - Print code to console (for now, email later)
  - Return success
- [ ] **AUTH-8**: Create logout endpoint (`POST /api/auth/logout`)
  - Destroy session
- [ ] **AUTH-9**: Create session check endpoint (`GET /api/auth/me`)
  - Return current user from session
- [ ] **AUTH-10**: Create authentication middleware
  - Check if user is authenticated
  - Check if user is admin (for admin routes)
- [ ] **AUTH-11**: Add `isAdmin` field to User model in Prisma schema
- [ ] **AUTH-12**: Create admin user initialization on server startup
  - Read ADMIN_EMAILS from env (comma-separated)
  - Ensure all admin emails exist as users with `isAdmin: true`
  - Create users if they don't exist
- [ ] **AUTH-13**: Create user verification/approval endpoint (`POST /api/users/:id/verify`)
  - Check if requester is admin or member of same company
  - Set `verifiedAccount: true`
- [ ] **AUTH-14**: Create pending users list endpoint (`GET /api/users/pending`)
  - Admin: see all unverified users
  - Company member: see unverified users in their company

### Frontend
- [ ] **AUTH-15**: Set up state management (Zustand or React Context) for auth
- [ ] **AUTH-16**: Create API client utility for making authenticated requests
- [ ] **AUTH-17**: Create Login page component
  - Email/password form
  - Magic code option/link
  - Error handling
  - Redirect after login
- [ ] **AUTH-18**: Create Register page component
  - Email, password, confirm password fields
  - Validation
  - Error handling
  - Show message about verification required
  - Redirect to login after registration
- [ ] **AUTH-19**: Create Magic Code login page
  - Email input
  - Request code button
  - Code input form
  - Error handling
- [ ] **AUTH-20**: Create Protected Route component
  - Check authentication
  - Check verification status
  - Redirect to login if not authenticated
  - Show verification pending message if not verified
- [ ] **AUTH-21**: Create navigation/header component
  - Show user email when logged in
  - Logout button
  - Conditional rendering based on auth state

---

## 🏢 Company Management (Multi-tenancy)

### Backend
- [x] **COMP-1**: Create company list endpoint (`GET /api/companies`)
  - Admin: return all companies
  - Regular user: return only their company
- [x] **COMP-2**: Create company detail endpoint (`GET /api/companies/:id`)
  - Check user has access (admin or member of company)
- [x] **COMP-3**: Create company creation endpoint (`POST /api/companies`)
  - Admin only
  - Validate required fields
  - Create company with default settings
- [x] **COMP-4**: Create company update endpoint (`PUT /api/companies/:id`)
  - Admin only
  - Validate and update fields
- [x] **COMP-5**: Create assign user to company endpoint (`POST /api/companies/:id/users`)
  - Admin only
  - Add user to company
- [x] **COMP-6**: Create remove user from company endpoint (`DELETE /api/companies/:id/users/:userId`)
  - Admin only

### Frontend
- [x] **COMP-7**: Create company list page
  - Table/list view of companies
  - Admin: see all companies
  - Regular user: see their company only
- [x] **COMP-8**: Create company detail/edit page
  - Form with all company fields
  - Default settings section
  - Save button
- [x] **COMP-9**: Create company user management component
  - List of users in company
  - Add user form
  - Remove user button

---

## 📝 Application Onboarding Forms

### Backend
- [x] **APP-1**: Create application submission endpoint (`POST /api/applications`)
  - Validate required fields (name, company)
  - Create application with company association
  - Auto-create interface applications if they don't exist
- [x] **APP-2**: Create application search endpoint (`GET /api/applications/search/name`)
  - Debounced search for interface autocomplete
- [x] **APP-3**: Create application list endpoint (`GET /api/applications`)
  - Filter by company (user's company or admin sees all)
  - Include company information
- [x] **APP-4**: Create application detail endpoint (`GET /api/applications/:id`)
  - Check user has access
  - Return full application data
- [x] **APP-5**: Create application update endpoint (`PUT /api/applications/:id`)
  - Check user has access
  - Update application fields
- [x] **APP-6**: Company defaults available via company detail endpoint

### Frontend
- [x] **APP-7**: Create application onboarding form page
  - Application name, description, owner, repo URL
  - Company selector (if admin)
  - All application detail fields
  - Interface search with auto-create
  - Security tools configuration
  - Autofill from company defaults option
- [x] **APP-8**: Interface management with debounced search
  - Search existing applications
  - Auto-create if doesn't exist
  - Tag-based interface list
- [x] **APP-9**: Create application list page
  - Table view
  - Filter by company (if admin)
  - Link to detail page
- [x] **APP-10**: Create application detail page
  - Display all application information
  - Edit mode (if user has permission)
  - Status indicator

---

## 👑 Admin Dashboard

### Backend
- [x] **ADMIN-1**: Add `isAdmin` field to User model (or use a role system)
- [x] **ADMIN-2**: Create admin middleware (check `isAdmin` flag)
- [x] **ADMIN-3**: Create admin stats endpoint (`GET /api/admin/stats`)
  - Total companies
  - Total applications
  - Total users
  - Applications by status
- [x] **ADMIN-4**: Create admin companies management endpoint (reuse COMP endpoints with admin check)
- [x] **ADMIN-5**: Create admin applications list endpoint
  - All applications across all companies
  - Filtering and pagination

### Frontend
- [x] **ADMIN-6**: Create admin dashboard page
  - Stats cards/widgets
  - Quick links to companies and applications
- [x] **ADMIN-7**: Create admin companies management page (reuse COMP components)
- [x] **ADMIN-8**: Create admin applications management page
  - Full list with company column
  - Filtering options

---

## 📊 Grading System

### Backend
- [ ] **GRADE-1**: Create grading fields in schema (if not already present)
  - Communication score
  - Security procedures score
  - Data freshness score
  - Overall grade/rating
- [ ] **GRADE-2**: Create application grading endpoint (`POST /api/applications/:id/grade`)
  - Admin only
  - Validate scores
  - Update application with grades
- [ ] **GRADE-3**: Create company grading endpoint (`POST /api/companies/:id/grade`)
  - Admin only
  - Store company-level grades
- [ ] **GRADE-4**: Create grading history/log endpoint
  - Track when grades were assigned
  - Who assigned them

### Frontend
- [ ] **GRADE-5**: Create grading form component
  - Communication score input (1-5 or similar)
  - Security procedures score
  - Data freshness score
  - Notes/comments field
  - Submit button
- [ ] **GRADE-6**: Display grades on application detail page
  - Show current grades
  - Show grading history
- [ ] **GRADE-7**: Display grades on company detail page
  - Show company-level grades

---

## 🎨 UI/UX Foundation

### Frontend
- [ ] **UI-1**: Set up routing (React Router)
  - Define all routes
  - Set up route structure
- [ ] **UI-2**: Create layout component
  - Header/navigation
  - Main content area
  - Footer (optional)
- [ ] **UI-3**: Create reusable form components
  - Input field
  - Select/dropdown
  - Textarea
  - Checkbox
  - Radio buttons
  - Form validation display
- [ ] **UI-4**: Create reusable UI components
  - Button
  - Card
  - Table
  - Modal/Dialog
  - Loading spinner
  - Error message display
- [ ] **UI-5**: Create toast/notification system
  - Success messages
  - Error messages
  - Info messages
- [ ] **UI-6**: Set up consistent styling/theme
  - Color scheme
  - Typography
  - Spacing system
  - Component styling

---

## 🔧 Infrastructure & Polish

### Backend
- [ ] **INFRA-1**: Set up error handling middleware
  - Consistent error responses
  - Error logging
- [ ] **INFRA-2**: Set up request validation middleware
  - Validate request bodies
  - Return clear validation errors
- [ ] **INFRA-3**: Add API documentation (optional)
- [ ] **INFRA-4**: Set up logging system
- [ ] **INFRA-5**: Add rate limiting (optional)

### Frontend
- [ ] **INFRA-6**: Set up error boundary component
- [ ] **INFRA-7**: Add loading states throughout
- [ ] **INFRA-8**: Add form validation throughout
- [ ] **INFRA-9**: Optimize API calls (caching, debouncing)
- [ ] **INFRA-10**: Add accessibility features (ARIA labels, keyboard navigation)

---

## 📋 Questions for Clarification

Before we start, I need to clarify a few things:

1. **User Roles**: Should we have just "admin" vs "regular user", or do you want more granular roles (e.g., company admin, viewer, etc.)?

2. **Application Status Flow**: What are the different states an application can be in? (e.g., "pending_executive", "pending_technical", "onboarded", "archived"?)

3. **Grading Scale**: What scale should we use for grading? (1-5, 1-10, letter grades, etc.)?

4. **Company Defaults**: What specific fields should be included in company defaults that can autofill the technical form?

5. **Magic Code**: How long should magic codes be valid? Should there be a limit on how many can be active at once per user?

6. **Application Interfaces**: For "what other applications it interfaces with" - should this be a free-text field, a multi-select from existing applications, or tags?

7. **Security Tools**: What security tools should be included in the technical form? (SAST, DAST, WAF, etc. - I see some in the schema already)

8. **Scoring Config Files**: I see you have `integrationLevels.json`, `riskFactors.json`, and `toolQuality.json` - how should these be used in the grading system?

---

## 🚀 Suggested Starting Order

1. **Authentication & User Management** (AUTH-1 through AUTH-17) - Foundation for everything else
2. **UI/UX Foundation** (UI-1 through UI-6) - Build reusable components
3. **Company Management** (COMP-1 through COMP-9) - Multi-tenancy foundation
4. **Application Onboarding Forms** (APP-1 through APP-10) - Core feature
5. **Admin Dashboard** (ADMIN-1 through ADMIN-8) - Management tools
6. **Grading System** (GRADE-1 through GRADE-7) - Advanced feature
7. **Infrastructure & Polish** (INFRA-1 through INFRA-10) - Final touches

---

**Status Legend:**
- `[ ]` = Not started
- `[~]` = In progress
- `[x]` = Completed

