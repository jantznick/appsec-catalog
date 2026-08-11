// Atlas SAMM-aligned question bank.
// This is an Atlas-authored, streamlined assessment mapped to OWASP SAMM 2.0.
// It is intentionally independent of the SAMMwise questionnaire implementation.

export const ATLAS_SAMM_QUESTION_BANK_VERSION = 'atlas-samm-1.0';

const choices = (none, foundational, managed, optimized) => [
  { value: 0, text: none },
  { value: 1, text: foundational },
  { value: 2, text: managed },
  { value: 3, text: optimized },
];

const question = (id, stream, streamName, title, measures, answerChoices) => ({
  id: `atlas-v1-${id}`,
  stream,
  streamName,
  title,
  measures,
  choices: answerChoices,
});

export const ATLAS_SAMM_QUESTIONS = {
  'governance-1': [
    question('governance-1-stream-a', 'A', 'Create & Promote', 'How is the application security strategy established and maintained?', 'Whether application security priorities are risk-based, documented, used for decisions, and kept current.', choices(
      'There is no documented application security strategy or agreed risk appetite.',
      'Leadership’s application risk appetite and the organization’s primary security risks are documented.',
      'A funded application security roadmap is aligned with business priorities and used to guide decisions.',
      'The roadmap is reviewed at least annually and updated when risks, business priorities, or results change.',
    )),
    question('governance-1-stream-b', 'B', 'Measure & Improve', 'How does the organization measure and improve its application security program?', 'Whether program metrics are defined, converted into meaningful targets, and used to improve strategy.', choices(
      'Program effectiveness is not measured consistently.',
      'Documented metrics track security effort, results, or the application environment.',
      'Meaningful KPIs and targets are reported to the teams and leaders responsible for outcomes.',
      'Metrics and KPIs are reviewed regularly and directly drive roadmap and investment changes.',
    )),
  ],
  'governance-2': [
    question('governance-2-stream-a', 'A', 'Policy & Standards', 'How are application security policies and standards applied during software delivery?', 'Whether policies are documented, actionable for delivery teams, measured, and improved.', choices(
      'Application security policies and standards are not formally documented.',
      'A common set of documented policies and standards is available to development teams.',
      'Policies are translated into practical checklists, test procedures, or delivery requirements.',
      'Adherence is reported regularly and the results are used to improve policies and implementation.',
    )),
    question('governance-2-stream-b', 'B', 'Compliance Management', 'How does the organization manage external application security obligations?', 'Whether obligations are known, mapped to controls, measured, and actively remediated.', choices(
      'External application security obligations are not centrally identified or tracked.',
      'Applicable legal, regulatory, and contractual obligations are documented with ownership.',
      'Each obligation is mapped to defined application requirements and verification procedures.',
      'Compliance is measured regularly, reported to stakeholders, and gaps are assigned and tracked to closure.',
    )),
  ],
  'governance-3': [
    question('governance-3-stream-a', 'A', 'Training & Awareness', 'How is secure software training delivered and tracked?', 'Whether training is repeatable, role-specific, and measured for completion and effectiveness.', choices(
      'Secure software training is not consistently required or available.',
      'Repeatable foundational training is required for people involved in software delivery.',
      'Training is tailored to roles such as developers, testers, architects, and security champions.',
      'Training and certifications are centrally tracked, measured for effectiveness, and updated based on results.',
    )),
    question('governance-3-stream-b', 'B', 'Organization & Culture', 'How is application security expertise embedded across development teams?', 'Whether teams have security contacts, central expertise, and a sustainable knowledge-sharing mechanism.', choices(
      'Development teams do not have defined application security support or contacts.',
      'Development teams have trained security champions or another identified security contact.',
      'A defined software security center of excellence coordinates guidance and cross-team support.',
      'A widely used central knowledge portal connects teams, guidance, announcements, and application-level metrics.',
    )),
  ],
  'design-1': [
    question('design-1-stream-a', 'A', 'Application Risk Profile', 'How are applications classified and maintained according to business and security risk?', 'Whether application risk classification is consistent, quantified, centralized, and reviewed.', choices(
      'Applications are not classified using a consistent risk method.',
      'Applications are classified using an agreed set of business and security risk questions.',
      'Risk profiles are quantified, centrally available, and aligned with the organization’s risk standard.',
      'Risk profiles and the classification method are reviewed regularly using operational and historical feedback.',
    )),
    question('design-1-stream-b', 'B', 'Threat Modeling', 'How is threat modeling used to identify and manage design risk?', 'Whether threat modeling is performed, standardized by risk, and improved over time.', choices(
      'Threat modeling is not performed consistently.',
      'Threat modeling is performed for high-risk applications and significant architectural changes.',
      'A documented methodology is used according to application risk, with trained participants and tracked findings.',
      'The methodology and threat models are reviewed regularly and improved using incidents, findings, and feedback.',
    )),
  ],
  'design-2': [
    question('design-2-stream-a', 'A', 'Software Requirements', 'How are application security requirements defined and managed during development?', 'Whether requirements are captured, prioritized, standardized, and traceable through delivery.', choices(
      'Security requirements are not consistently captured during development.',
      'Teams derive and document security requirements from functionality, policy, risk, and stakeholder needs.',
      'Requirements are structured, prioritized, and maintained in normal delivery artifacts with ownership.',
      'A standard requirements framework supports consistent reuse, traceability, and continuous improvement.',
    )),
    question('design-2-stream-b', 'B', 'Supplier Security', 'How are software suppliers held accountable for application security?', 'Whether supplier requirements are contractual, measured, and aligned with internal secure-delivery expectations.', choices(
      'Supplier agreements do not consistently address application security.',
      'Security requirements, activities, and responsibilities are included when supplier agreements are created.',
      'Supplier security responsibilities and quality measures are defined in agreements and reviewed against delivery.',
      'Suppliers demonstrate secure lifecycle controls aligned with the organization’s build, deployment, defect, and incident processes.',
    )),
  ],
  'design-3': [
    question('design-3-stream-a', 'A', 'Architecture Design', 'How do teams apply approved security architecture during solution design?', 'Whether design uses principles, reusable services, and approved reference architectures.', choices(
      'Teams do not consistently use documented security architecture guidance.',
      'Teams use an agreed checklist of security principles during design.',
      'Documented reusable security services are available and used where applicable.',
      'Approved reference architectures guide solution design and are maintained from assessment and delivery feedback.',
    )),
    question('design-3-stream-b', 'B', 'Technology Management', 'How does the organization govern technologies used to build and operate applications?', 'Whether technology inventory, recommendations, approval, and conformance monitoring are established.', choices(
      'Important application technologies are not inventoried or evaluated consistently.',
      'Each application’s important technologies and supporting components are inventoried and security-reviewed.',
      'The organization maintains approved and discouraged technology guidance based on portfolio risk and experience.',
      'Technology use is monitored regularly and exceptions to approved guidance are prevented or formally governed.',
    )),
  ],
  'implementation-1': [
    question('implementation-1-stream-a', 'A', 'Build Process', 'How is the software build process documented, automated, and secured?', 'Whether builds are reproducible, automated, and enforce security baselines.', choices(
      'Build processes are primarily manual or cannot be reproduced reliably.',
      'Build processes are documented well enough to be recreated consistently.',
      'Builds are automated and execute without routine human intervention.',
      'Automated security checks enforce a defined baseline and block or govern noncompliant builds.',
    )),
    question('implementation-1-stream-b', 'B', 'Software Dependencies', 'How are third-party software dependencies inventoried and governed?', 'Whether dependencies are known, approved through risk criteria, and blocked when unacceptable.', choices(
      'Dependencies are not consistently inventoried or assessed.',
      'A current software bill of materials or equivalent dependency inventory exists for each application.',
      'A formal process evaluates and approves dependencies using defined security and maintenance criteria.',
      'Builds detect unacceptable dependency risk and block release unless the finding is resolved or explicitly accepted.',
    )),
  ],
  'implementation-2': [
    question('implementation-2-stream-a', 'A', 'Deployment Process', 'How are application deployments made repeatable, secure, and verifiable?', 'Whether deployments are documented, automated with checks, and protected by artifact-integrity validation.', choices(
      'Deployments rely on undocumented or inconsistent manual steps.',
      'Deployment procedures are documented and repeatable across applicable environments.',
      'Deployments are automated and include security checks before promotion.',
      'Artifact integrity is verified and deployments are prevented or rolled back when integrity validation fails.',
    )),
    question('implementation-2-stream-b', 'B', 'Secret Management', 'How are application secrets stored, delivered, and maintained?', 'Whether secrets are protected, removed from source, injected securely, and lifecycle-managed.', choices(
      'Application secrets are stored or shared without consistent controls.',
      'Production secrets are kept in secured locations with least-privilege access.',
      'Active secrets are removed from source and injected securely during deployment or runtime.',
      'A vetted secrets-management solution automates generation, rotation, synchronization, and revocation.',
    )),
  ],
  'implementation-3': [
    question('implementation-3-stream-a', 'A', 'Defect Tracking', 'How are application security defects tracked and remediated?', 'Whether defects are visible, consistently prioritized, and governed by remediation expectations.', choices(
      'Security defects are tracked inconsistently or across inaccessible locations.',
      'Each application has an accessible, current view of its known security defects.',
      'A consistent severity model provides organization-wide visibility into defect state and ownership.',
      'Risk-based remediation SLAs are enforced, with breaches escalated through a defined risk process.',
    )),
    question('implementation-3-stream-b', 'B', 'Metrics & Feedback', 'How does defect information improve the software security program?', 'Whether defect metrics are analyzed, standardized, and used to change strategy and prevention.', choices(
      'Security defect data is not analyzed for program improvement.',
      'Basic defect trends are reviewed at least annually to identify practical improvements.',
      'Standardized defect classification and metrics guide prevention and assurance improvements.',
      'Metric effectiveness is reviewed regularly and defect insights directly influence security strategy and controls.',
    )),
  ],
  'verification-1': [
    question('verification-1-stream-a', 'A', 'Architecture Validation', 'How is application architecture reviewed for security-control effectiveness?', 'Whether architecture and controls are reviewed consistently against requirements and actual capabilities.', choices(
      'Application architecture is not reviewed consistently for security objectives.',
      'Architecture reviews use an agreed model to evaluate key security objectives for important applications.',
      'Security mechanisms are reviewed regularly against internal and external requirements.',
      'Reviews evaluate preventive, detective, and response effectiveness and feed improvements into architecture guidance.',
    )),
    question('verification-1-stream-b', 'B', 'Architecture Compliance', 'How is architecture evaluated against threats and approved patterns?', 'Whether reviews cover common threats, application-specific threats, and updates to reference architecture.', choices(
      'Architecture is not consistently evaluated against relevant threats or approved patterns.',
      'Reviews verify mitigations for common threats using an agreed representation of the architecture.',
      'Reviews systematically evaluate threats identified through the application’s threat assessment.',
      'Assessments follow a standardized method and findings are used to update reference architectures and patterns.',
    )),
  ],
  'verification-2': [
    question('verification-2-stream-a', 'A', 'Control Verification', 'How are security requirements and controls verified through testing?', 'Whether core controls, application requirements, and regression scenarios are tested consistently.', choices(
      'Security controls and requirements are not tested consistently.',
      'Testing verifies core controls such as authentication, authorization, input handling, and encryption.',
      'Application-specific test cases verify documented security requirements and expected behavior.',
      'Security regression tests are automated and added when defects or control failures are discovered.',
    )),
    question('verification-2-stream-b', 'B', 'Misuse/Abuse Testing', 'How does testing evaluate unexpected, malicious, and stress conditions?', 'Whether fuzzing, abuse cases, and targeted resilience testing are part of verification.', choices(
      'Testing focuses only on expected functional behavior.',
      'Randomized or fuzz testing covers important application inputs and interfaces.',
      'Documented abuse cases for important business functions drive repeatable security tests.',
      'Targeted denial-of-service and security stress tests evaluate application-specific resource and resilience risks.',
    )),
  ],
  'verification-3': [
    question('verification-3-stream-a', 'A', 'Scalable Baseline', 'How is automated security testing applied across the software lifecycle?', 'Whether automated testing is deployed, tuned, integrated, and visible to accountable stakeholders.', choices(
      'Applications are not consistently scanned with automated security testing tools.',
      'Automated tools perform repeatable security testing for applications in scope.',
      'Tools are tuned to relevant applications and technology stacks to improve coverage and signal quality.',
      'Testing is integrated into build and deployment workflows, with results tracked by accountable teams and leaders.',
    )),
    question('verification-3-stream-b', 'B', 'Deep Understanding', 'How are high-risk applications evaluated beyond automated scanning?', 'Whether manual review, penetration testing, and cross-activity learning provide deeper assurance.', choices(
      'High-risk applications do not receive consistent testing beyond automated scanning.',
      'Selected high-risk components receive focused manual security review using defined criteria.',
      'Applications receive periodic, application-specific penetration testing based on risk.',
      'Results from testing and other security activities are analyzed together to improve development and integrated testing.',
    )),
  ],
  'operations-1': [
    question('operations-1-stream-a', 'A', 'Incident Detection', 'How are application security incidents detected and investigated?', 'Whether detection uses owned processes, repeatable analysis, and regular improvement.', choices(
      'Application security incidents are detected primarily through chance or external notification.',
      'Relevant logs are reviewed and a defined contact receives and creates application security incidents.',
      'A documented, owned detection process consistently analyzes relevant signals and creates incidents.',
      'Detection procedures and coverage are reviewed at least annually and improved using incident experience.',
    )),
    question('operations-1-stream-b', 'B', 'Incident Response', 'How does the organization respond to application security incidents?', 'Whether response ownership, repeatable handling, and specialist/root-cause capabilities are established.', choices(
      'Application security incidents do not have defined response ownership or procedures.',
      'A defined person or role coordinates response to detected application security incidents.',
      'A repeatable process classifies, contains, communicates, and resolves incidents.',
      'A dedicated response capability performs root-cause analysis and feeds lessons into preventive improvements.',
    )),
  ],
  'operations-2': [
    question('operations-2-stream-a', 'A', 'Configuration Hardening', 'How are secure configuration baselines established and enforced?', 'Whether key components are identified, baselines are owned, and conformity is monitored.', choices(
      'Secure configuration expectations are not consistently documented or checked.',
      'Key technology components are identified and hardened using documented guidance.',
      'Owned configuration baselines are maintained for important components and environments.',
      'Conformance with baselines is checked regularly and automated enforcement or remediation is used where practical.',
    )),
    question('operations-2-stream-b', 'B', 'Patch & Update', 'How are vulnerable technology components identified and updated?', 'Whether component versions are known, patching follows a process, and lifecycle state is reviewed.', choices(
      'Component versions and vulnerable software are not consistently identified or patched.',
      'Applications maintain current component and version information and address known vulnerable components.',
      'An established process evaluates, prioritizes, tests, and deploys first- and third-party updates.',
      'Component lifecycle and patch status are reviewed regularly, with measurable coverage and escalation for overdue risk.',
    )),
  ],
  'operations-3': [
    question('operations-3-stream-a', 'A', 'Data Protection', 'How is application data identified, protected, and monitored?', 'Whether data handling requirements are known, cataloged, reviewed, and monitored for violations.', choices(
      'Applications do not consistently identify sensitive data or apply documented protection requirements.',
      'Teams know which data each application processes and apply defined handling and protection requirements.',
      'A maintained data catalog records data type, sensitivity, processing, storage, and ownership information.',
      'The catalog and protection requirements are reviewed regularly, with monitoring for attempted or actual violations.',
    )),
    question('operations-3-stream-b', 'B', 'Legacy Management', 'How are unsupported and end-of-life software assets governed?', 'Whether legacy assets are identified, decommissioned through a process, and proactively lifecycle-managed.', choices(
      'Unsupported or unused applications and dependencies are not consistently identified or removed.',
      'Unsupported and unused software assets are identified, tracked, and removed or explicitly risk-accepted.',
      'A documented decommissioning process removes associated data, access, infrastructure, and dependencies.',
      'Lifecycle and support status are reviewed proactively, with agreed end-of-life plans before support expires.',
    )),
  ],
};

export const ATLAS_SAMM_TOTAL_QUESTIONS = Object.values(ATLAS_SAMM_QUESTIONS)
  .reduce((total, practiceQuestions) => total + practiceQuestions.length, 0);
