zsh:1: command not found: +ATLAS_SAMM_QUESTION_BANK_VERSION+
zsh:1: command not found: +c.value+
# Orbit SAMM-Aligned Question Bank

Version: 

This is the approved Orbit-authored questionnaire mapped to the 15 practices and 30 streams in OWASP SAMM 2.0. It is not the SAMMwise questionnaire and is not presented as an official OWASP SAMM Toolbox assessment.

Each question has four factual operating states. Values 0–3 are internal scoring metadata and are not displayed as maturity choices in the assessment UI. The two stream values are averaged for the practice score; all 15 practice scores are averaged for the company score.

## Governance — Strategy & Metrics

### Create & Promote

**Question:** How is the application security strategy established and maintained?

**Measures:** Whether application security priorities are risk-based, documented, used for decisions, and kept current.

**Answer choices:**

-  — There is no documented application security strategy or agreed risk appetite.
-  — Leadership’s application risk appetite and the organization’s primary security risks are documented.
-  — A funded application security roadmap is aligned with business priorities and used to guide decisions.
-  — The roadmap is reviewed at least annually and updated when risks, business priorities, or results change.

### Measure & Improve

**Question:** How does the organization measure and improve its application security program?

**Measures:** Whether program metrics are defined, converted into meaningful targets, and used to improve strategy.

**Answer choices:**

-  — Program effectiveness is not measured consistently.
-  — Documented metrics track security effort, results, or the application environment.
-  — Meaningful KPIs and targets are reported to the teams and leaders responsible for outcomes.
-  — Metrics and KPIs are reviewed regularly and directly drive roadmap and investment changes.

## Governance — Policy & Compliance

### Policy & Standards

**Question:** How are application security policies and standards applied during software delivery?

**Measures:** Whether policies are documented, actionable for delivery teams, measured, and improved.

**Answer choices:**

-  — Application security policies and standards are not formally documented.
-  — A common set of documented policies and standards is available to development teams.
-  — Policies are translated into practical checklists, test procedures, or delivery requirements.
-  — Adherence is reported regularly and the results are used to improve policies and implementation.

### Compliance Management

**Question:** How does the organization manage external application security obligations?

**Measures:** Whether obligations are known, mapped to controls, measured, and actively remediated.

**Answer choices:**

-  — External application security obligations are not centrally identified or tracked.
-  — Applicable legal, regulatory, and contractual obligations are documented with ownership.
-  — Each obligation is mapped to defined application requirements and verification procedures.
-  — Compliance is measured regularly, reported to stakeholders, and gaps are assigned and tracked to closure.

## Governance — Education & Guidance

### Training & Awareness

**Question:** How is secure software training delivered and tracked?

**Measures:** Whether training is repeatable, role-specific, and measured for completion and effectiveness.

**Answer choices:**

-  — Secure software training is not consistently required or available.
-  — Repeatable foundational training is required for people involved in software delivery.
-  — Training is tailored to roles such as developers, testers, architects, and security champions.
-  — Training and certifications are centrally tracked, measured for effectiveness, and updated based on results.

### Organization & Culture

**Question:** How is application security expertise embedded across development teams?

**Measures:** Whether teams have security contacts, central expertise, and a sustainable knowledge-sharing mechanism.

**Answer choices:**

-  — Development teams do not have defined application security support or contacts.
-  — Development teams have trained security champions or another identified security contact.
-  — A defined software security center of excellence coordinates guidance and cross-team support.
-  — A widely used central knowledge portal connects teams, guidance, announcements, and application-level metrics.

## Design — Threat Assessment

### Application Risk Profile

**Question:** How are applications classified and maintained according to business and security risk?

**Measures:** Whether application risk classification is consistent, quantified, centralized, and reviewed.

**Answer choices:**

-  — Applications are not classified using a consistent risk method.
-  — Applications are classified using an agreed set of business and security risk questions.
-  — Risk profiles are quantified, centrally available, and aligned with the organization’s risk standard.
-  — Risk profiles and the classification method are reviewed regularly using operational and historical feedback.

### Threat Modeling

**Question:** How is threat modeling used to identify and manage design risk?

**Measures:** Whether threat modeling is performed, standardized by risk, and improved over time.

**Answer choices:**

-  — Threat modeling is not performed consistently.
-  — Threat modeling is performed for high-risk applications and significant architectural changes.
-  — A documented methodology is used according to application risk, with trained participants and tracked findings.
-  — The methodology and threat models are reviewed regularly and improved using incidents, findings, and feedback.

## Design — Security Requirements

### Software Requirements

**Question:** How are application security requirements defined and managed during development?

**Measures:** Whether requirements are captured, prioritized, standardized, and traceable through delivery.

**Answer choices:**

-  — Security requirements are not consistently captured during development.
-  — Teams derive and document security requirements from functionality, policy, risk, and stakeholder needs.
-  — Requirements are structured, prioritized, and maintained in normal delivery artifacts with ownership.
-  — A standard requirements framework supports consistent reuse, traceability, and continuous improvement.

### Supplier Security

**Question:** How are software suppliers held accountable for application security?

**Measures:** Whether supplier requirements are contractual, measured, and aligned with internal secure-delivery expectations.

**Answer choices:**

-  — Supplier agreements do not consistently address application security.
-  — Security requirements, activities, and responsibilities are included when supplier agreements are created.
-  — Supplier security responsibilities and quality measures are defined in agreements and reviewed against delivery.
-  — Suppliers demonstrate secure lifecycle controls aligned with the organization’s build, deployment, defect, and incident processes.

## Design — Security Architecture

### Architecture Design

**Question:** How do teams apply approved security architecture during solution design?

**Measures:** Whether design uses principles, reusable services, and approved reference architectures.

**Answer choices:**

-  — Teams do not consistently use documented security architecture guidance.
-  — Teams use an agreed checklist of security principles during design.
-  — Documented reusable security services are available and used where applicable.
-  — Approved reference architectures guide solution design and are maintained from assessment and delivery feedback.

### Technology Management

**Question:** How does the organization govern technologies used to build and operate applications?

**Measures:** Whether technology inventory, recommendations, approval, and conformance monitoring are established.

**Answer choices:**

-  — Important application technologies are not inventoried or evaluated consistently.
-  — Each application’s important technologies and supporting components are inventoried and security-reviewed.
-  — The organization maintains approved and discouraged technology guidance based on portfolio risk and experience.
-  — Technology use is monitored regularly and exceptions to approved guidance are prevented or formally governed.

## Implementation — Secure Build

### Build Process

**Question:** How is the software build process documented, automated, and secured?

**Measures:** Whether builds are reproducible, automated, and enforce security baselines.

**Answer choices:**

-  — Build processes are primarily manual or cannot be reproduced reliably.
-  — Build processes are documented well enough to be recreated consistently.
-  — Builds are automated and execute without routine human intervention.
-  — Automated security checks enforce a defined baseline and block or govern noncompliant builds.

### Software Dependencies

**Question:** How are third-party software dependencies inventoried and governed?

**Measures:** Whether dependencies are known, approved through risk criteria, and blocked when unacceptable.

**Answer choices:**

-  — Dependencies are not consistently inventoried or assessed.
-  — A current software bill of materials or equivalent dependency inventory exists for each application.
-  — A formal process evaluates and approves dependencies using defined security and maintenance criteria.
-  — Builds detect unacceptable dependency risk and block release unless the finding is resolved or explicitly accepted.

## Implementation — Secure Deployment

### Deployment Process

**Question:** How are application deployments made repeatable, secure, and verifiable?

**Measures:** Whether deployments are documented, automated with checks, and protected by artifact-integrity validation.

**Answer choices:**

-  — Deployments rely on undocumented or inconsistent manual steps.
-  — Deployment procedures are documented and repeatable across applicable environments.
-  — Deployments are automated and include security checks before promotion.
-  — Artifact integrity is verified and deployments are prevented or rolled back when integrity validation fails.

### Secret Management

**Question:** How are application secrets stored, delivered, and maintained?

**Measures:** Whether secrets are protected, removed from source, injected securely, and lifecycle-managed.

**Answer choices:**

-  — Application secrets are stored or shared without consistent controls.
-  — Production secrets are kept in secured locations with least-privilege access.
-  — Active secrets are removed from source and injected securely during deployment or runtime.
-  — A vetted secrets-management solution automates generation, rotation, synchronization, and revocation.

## Implementation — Defect Management

### Defect Tracking

**Question:** How are application security defects tracked and remediated?

**Measures:** Whether defects are visible, consistently prioritized, and governed by remediation expectations.

**Answer choices:**

-  — Security defects are tracked inconsistently or across inaccessible locations.
-  — Each application has an accessible, current view of its known security defects.
-  — A consistent severity model provides organization-wide visibility into defect state and ownership.
-  — Risk-based remediation SLAs are enforced, with breaches escalated through a defined risk process.

### Metrics & Feedback

**Question:** How does defect information improve the software security program?

**Measures:** Whether defect metrics are analyzed, standardized, and used to change strategy and prevention.

**Answer choices:**

-  — Security defect data is not analyzed for program improvement.
-  — Basic defect trends are reviewed at least annually to identify practical improvements.
-  — Standardized defect classification and metrics guide prevention and assurance improvements.
-  — Metric effectiveness is reviewed regularly and defect insights directly influence security strategy and controls.

## Verification — Architecture Assessment

### Architecture Validation

**Question:** How is application architecture reviewed for security-control effectiveness?

**Measures:** Whether architecture and controls are reviewed consistently against requirements and actual capabilities.

**Answer choices:**

-  — Application architecture is not reviewed consistently for security objectives.
-  — Architecture reviews use an agreed model to evaluate key security objectives for important applications.
-  — Security mechanisms are reviewed regularly against internal and external requirements.
-  — Reviews evaluate preventive, detective, and response effectiveness and feed improvements into architecture guidance.

### Architecture Compliance

**Question:** How is architecture evaluated against threats and approved patterns?

**Measures:** Whether reviews cover common threats, application-specific threats, and updates to reference architecture.

**Answer choices:**

-  — Architecture is not consistently evaluated against relevant threats or approved patterns.
-  — Reviews verify mitigations for common threats using an agreed representation of the architecture.
-  — Reviews systematically evaluate threats identified through the application’s threat assessment.
-  — Assessments follow a standardized method and findings are used to update reference architectures and patterns.

## Verification — Requirements-driven Testing

### Control Verification

**Question:** How are security requirements and controls verified through testing?

**Measures:** Whether core controls, application requirements, and regression scenarios are tested consistently.

**Answer choices:**

-  — Security controls and requirements are not tested consistently.
-  — Testing verifies core controls such as authentication, authorization, input handling, and encryption.
-  — Application-specific test cases verify documented security requirements and expected behavior.
-  — Security regression tests are automated and added when defects or control failures are discovered.

### Misuse/Abuse Testing

**Question:** How does testing evaluate unexpected, malicious, and stress conditions?

**Measures:** Whether fuzzing, abuse cases, and targeted resilience testing are part of verification.

**Answer choices:**

-  — Testing focuses only on expected functional behavior.
-  — Randomized or fuzz testing covers important application inputs and interfaces.
-  — Documented abuse cases for important business functions drive repeatable security tests.
-  — Targeted denial-of-service and security stress tests evaluate application-specific resource and resilience risks.

## Verification — Security Testing

### Scalable Baseline

**Question:** How is automated security testing applied across the software lifecycle?

**Measures:** Whether automated testing is deployed, tuned, integrated, and visible to accountable stakeholders.

**Answer choices:**

-  — Applications are not consistently scanned with automated security testing tools.
-  — Automated tools perform repeatable security testing for applications in scope.
-  — Tools are tuned to relevant applications and technology stacks to improve coverage and signal quality.
-  — Testing is integrated into build and deployment workflows, with results tracked by accountable teams and leaders.

### Deep Understanding

**Question:** How are high-risk applications evaluated beyond automated scanning?

**Measures:** Whether manual review, penetration testing, and cross-activity learning provide deeper assurance.

**Answer choices:**

-  — High-risk applications do not receive consistent testing beyond automated scanning.
-  — Selected high-risk components receive focused manual security review using defined criteria.
-  — Applications receive periodic, application-specific penetration testing based on risk.
-  — Results from testing and other security activities are analyzed together to improve development and integrated testing.

## Operations — Incident Management

### Incident Detection

**Question:** How are application security incidents detected and investigated?

**Measures:** Whether detection uses owned processes, repeatable analysis, and regular improvement.

**Answer choices:**

-  — Application security incidents are detected primarily through chance or external notification.
-  — Relevant logs are reviewed and a defined contact receives and creates application security incidents.
-  — A documented, owned detection process consistently analyzes relevant signals and creates incidents.
-  — Detection procedures and coverage are reviewed at least annually and improved using incident experience.

### Incident Response

**Question:** How does the organization respond to application security incidents?

**Measures:** Whether response ownership, repeatable handling, and specialist/root-cause capabilities are established.

**Answer choices:**

-  — Application security incidents do not have defined response ownership or procedures.
-  — A defined person or role coordinates response to detected application security incidents.
-  — A repeatable process classifies, contains, communicates, and resolves incidents.
-  — A dedicated response capability performs root-cause analysis and feeds lessons into preventive improvements.

## Operations — Environment Management

### Configuration Hardening

**Question:** How are secure configuration baselines established and enforced?

**Measures:** Whether key components are identified, baselines are owned, and conformity is monitored.

**Answer choices:**

-  — Secure configuration expectations are not consistently documented or checked.
-  — Key technology components are identified and hardened using documented guidance.
-  — Owned configuration baselines are maintained for important components and environments.
-  — Conformance with baselines is checked regularly and automated enforcement or remediation is used where practical.

### Patch & Update

**Question:** How are vulnerable technology components identified and updated?

**Measures:** Whether component versions are known, patching follows a process, and lifecycle state is reviewed.

**Answer choices:**

-  — Component versions and vulnerable software are not consistently identified or patched.
-  — Applications maintain current component and version information and address known vulnerable components.
-  — An established process evaluates, prioritizes, tests, and deploys first- and third-party updates.
-  — Component lifecycle and patch status are reviewed regularly, with measurable coverage and escalation for overdue risk.

## Operations — Operational Management

### Data Protection

**Question:** How is application data identified, protected, and monitored?

**Measures:** Whether data handling requirements are known, cataloged, reviewed, and monitored for violations.

**Answer choices:**

-  — Applications do not consistently identify sensitive data or apply documented protection requirements.
-  — Teams know which data each application processes and apply defined handling and protection requirements.
-  — A maintained data catalog records data type, sensitivity, processing, storage, and ownership information.
-  — The catalog and protection requirements are reviewed regularly, with monitoring for attempted or actual violations.

### Legacy Management

**Question:** How are unsupported and end-of-life software assets governed?

**Measures:** Whether legacy assets are identified, decommissioned through a process, and proactively lifecycle-managed.

**Answer choices:**

-  — Unsupported or unused applications and dependencies are not consistently identified or removed.
-  — Unsupported and unused software assets are identified, tracked, and removed or explicitly risk-accepted.
-  — A documented decommissioning process removes associated data, access, infrastructure, and dependencies.
-  — Lifecycle and support status are reviewed proactively, with agreed end-of-life plans before support expires.

