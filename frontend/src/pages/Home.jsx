import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { OrbitMark } from '../components/Logo.jsx';
import { Button } from '../components/ui/Button.jsx';
import {
  FiEye, FiShield, FiTrendingUp, FiCheckCircle, FiClock, FiZap,
  FiUsers, FiLink, FiSettings, FiCompass, FiAlertTriangle, FiHelpCircle,
  FiBarChart2, FiActivity, FiCpu, FiLayers, FiRefreshCw, FiDatabase,
  FiArrowRight, FiArrowDown, FiSearch, FiPieChart, FiClipboard, FiCode,
  FiGitBranch, FiServer, FiMessageSquare, FiAward, FiBookOpen, FiGrid,
} from 'react-icons/fi';

/* ============================================================================
   Orbit / ASCOE marketing landing page (public root `/`).
   Full-bleed, single-scroll. Content mirrors the AppSec program slides:
   goals → why → lifecycle → operating model → AI harness → SAMM → ASCOE → Orbit.
   Renders full width because Layout drops its max-w container on the landing.
   ========================================================================== */

// ---- Small presentational helpers -----------------------------------------

function Eyebrow({ children, className = '' }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 ${className}`}>
      {children}
    </p>
  );
}

function Section({ id, children, className = '', bleed = 'transparent' }) {
  const bleedClass = {
    transparent: '',
    surface: 'bg-surface/40 border-y border-white/[0.06]',
    navy: 'bg-gradient-to-b from-navy-900/70 to-navy-950/70 border-y border-white/[0.06]',
  }[bleed];
  return (
    <section id={id} className={`relative w-full py-20 sm:py-24 ${bleedClass}`}>
      <div className={`mx-auto max-w-7xl px-6 lg:px-8 ${className}`}>{children}</div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, sub, center = true, className = '' }) {
  return (
    <div className={`${center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'} ${className}`}>
      {eyebrow && <Eyebrow className={center ? 'mb-3' : 'mb-3'}>{eyebrow}</Eyebrow>}
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">{title}</h2>
      {sub && <p className="mt-4 text-lg leading-relaxed text-gray-600">{sub}</p>}
    </div>
  );
}

// Accent → tailwind class maps (uses the app's remapped dark tokens).
const ACCENT = {
  teal: { text: 'text-blue-700', bg: 'bg-blue-600/15', ring: 'ring-blue-500/30', bar: 'bg-blue-600' },
  grape: { text: 'text-grape-600', bg: 'bg-grape-600/15', ring: 'ring-grape-500/30', bar: 'bg-grape-500' },
  green: { text: 'text-brandgreen-500', bg: 'bg-green-600/15', ring: 'ring-green-500/30', bar: 'bg-green-600' },
  navy: { text: 'text-navy-300', bg: 'bg-navy-500/20', ring: 'ring-navy-400/30', bar: 'bg-navy-500' },
};

// Donut gauge for the compliance card (illustrative — mirrors the dashboard ring).
function Gauge({ value = 87, label = 'Policy adherence', sub }) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - value / 100);
  return (
    <div className="relative mx-auto h-44 w-44">
      <svg viewBox="0 0 128 128" className="h-44 w-44 -rotate-90">
        <defs>
          <linearGradient id="gauge-grad" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2bbdd3" />
            <stop offset="1" stopColor="#9784d0" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="12" />
        <circle
          cx="64" cy="64" r={R} fill="none" stroke="url(#gauge-grad)" strokeWidth="12"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-bold text-gray-900">{value}%</span>
        <span className="mt-1 text-xs font-medium text-gray-500">{label}</span>
        {sub && <span className="text-[11px] text-gray-500">{sub}</span>}
      </div>
    </div>
  );
}

function IconBadge({ icon: Icon, accent = 'teal', size = 'md' }) {
  const a = ACCENT[accent] ?? ACCENT.teal;
  const dim = size === 'lg' ? 'h-14 w-14' : 'h-11 w-11';
  const ic = size === 'lg' ? 26 : 20;
  return (
    <span className={`inline-flex items-center justify-center rounded-xl ring-1 ${dim} ${a.bg} ${a.ring}`}>
      <Icon size={ic} className={a.text} />
    </span>
  );
}

// ---- Data ------------------------------------------------------------------

const CHALLENGES = [
  { c: 'Limited application visibility', i: 'Unknown risk exposure' },
  { c: 'Inconsistent testing practices', i: 'Vulnerabilities reach production' },
  { c: 'Manual security reviews', i: 'Delays and inefficiency' },
  { c: 'Limited reporting', i: 'Difficult executive oversight' },
];

const FUTURE_STATE = [
  'Consistent risk management',
  'Automated security validation',
  'Measurable compliance',
  'Executive transparency',
];

const GOALS = [
  { icon: FiEye, accent: 'teal', title: 'Visibility', body: 'Know what applications exist and who owns them.' },
  { icon: FiShield, accent: 'grape', title: 'Assurance', body: 'Ensure every application undergoes appropriate security testing.' },
  { icon: FiTrendingUp, accent: 'green', title: 'Governance', body: 'Measure, report, and continuously improve security outcomes.' },
];

const OUTCOMES = [
  { icon: FiCheckCircle, label: 'Reduced production risk' },
  { icon: FiClock, label: 'Earlier vulnerability detection' },
  { icon: FiZap, label: 'Faster remediation' },
  { icon: FiUsers, label: 'Consistent controls across businesses' },
  { icon: FiClipboard, label: 'Audit-ready security evidence' },
];

const PHASES = [
  { n: '01', accent: 'navy', title: 'Plan & Design', body: 'Secure by design with threat modeling and architecture review.', ai: 'AI-assisted threat models, risk-tier & data classification.' },
  { n: '02', accent: 'teal', title: 'Build & Commit', body: 'Secure coding with automated checks and fast feedback.', ai: 'Secure-coding prompts, PR-review copilots.' },
  { n: '03', accent: 'grape', title: 'CI Security Gates', body: 'Automated validation and policy enforcement before merge or release.', ai: 'Finding correlation, severity gates, exception evidence.' },
  { n: '04', accent: 'green', title: 'Release & Deploy', body: 'Validate artifacts, ensure integrity, and obtain release sign-off.', ai: 'Release-assurance checks, generated release summaries.' },
  { n: '05', accent: 'teal', title: 'Runtime Operations', body: 'Monitor, detect, and respond to security issues in production.', ai: 'Runtime-signal summaries, exposure-change alerts.' },
  { n: '06', accent: 'navy', title: 'Improve & Govern', body: 'Measure, mature, and feed lessons back into every phase.', ai: 'Metrics narratives, roadmap & champion topics.' },
];

const HARNESS_INPUTS = ['Catalog metadata', 'Source & PR context', 'Scanner findings', 'ASPM signals', 'Policy & standards', 'Exceptions & evidence'];
const HARNESS_OUTPUTS = ['Risk-ranked work queue', 'Remediation guidance', 'Validation prompts', 'Evidence summaries', 'Metrics narratives', 'Standard updates'];

const GUARDRAILS = [
  { title: 'Inputs', body: 'Inventory, findings, trends, champion insight' },
  { title: 'Policy', body: 'High-level mandatory requirements' },
  { title: 'Standards', body: 'Specific required controls' },
  { title: 'Guidelines', body: 'Recommended implementation approaches' },
  { title: 'AI Harnesses', body: 'Reusable checks, configs, prompts, pipeline helpers' },
];

const SAMM_MAP = [
  { phase: 'Plan & Design', domain: 'Governance / Design' },
  { phase: 'Build & Commit', domain: 'Implementation' },
  { phase: 'CI Security Gates', domain: 'Verification' },
  { phase: 'Release & Deploy', domain: 'Operations' },
  { phase: 'Runtime Operations', domain: 'Operations' },
  { phase: 'Improve & Govern', domain: 'Governance' },
];

const SAMM_BENEFITS = ['Industry best practices', 'Consistent maturity assessment', 'Benchmarking across business units', 'Continuous-improvement roadmap'];

const ASCOE_PILLARS = [
  {
    icon: FiMessageSquare, accent: 'teal', title: 'Quarterly ASCOE meetings',
    body: 'Latest trends & threats, vendor workshops (not sales pitches), shared wins, and peer problem-solving.',
  },
  {
    icon: FiAward, accent: 'grape', title: 'Champions program',
    body: 'A human + AI feedback loop — monthly enablement kits, hands-on Docker labs, and local codebase challenges. Champions help teams apply AI and security tools well, then feed real engineering context back into the program.',
  },
  {
    icon: FiCompass, accent: 'green', title: 'Orbit platform access',
    body: 'Real-time inventory, governance & compliance scoring, automated pipeline integration, and maturity benchmarking.',
  },
];

const ATLAS_PILLARS = [
  { icon: FiSearch, accent: 'teal', title: 'Know your landscape', body: 'Centralized inventory, business ownership & criticality, full portfolio visibility.' },
  { icon: FiBarChart2, accent: 'grape', title: 'Measure security health', body: 'Executive dashboards, application security scores, and SAMM maturity tracking.' },
  { icon: FiRefreshCw, accent: 'green', title: 'Drive continuous improvement', body: 'Security scorecards, remediation tracking, and business-unit benchmarking.' },
];

const COMPLIANCE_POINTS = [
  {
    icon: FiLayers, accent: 'teal', title: 'Your policy, encoded as controls',
    body: 'The SDLC and application-security requirements of your Information Security Policy become concrete, checkable controls — each with an ID, a category, and mappings to the application fields that satisfy it.',
  },
  {
    icon: FiCpu, accent: 'grape', title: 'Every app graded automatically',
    body: 'Orbit evaluates each application against the controls that apply to it — Meeting or Not Meeting — straight from the metadata already in the catalog. No questionnaire, no spreadsheet.',
  },
  {
    icon: FiRefreshCw, accent: 'green', title: 'On demand, always current',
    body: 'Compliance is recomputed live every time you look — see exactly where every app stands on any given day, not just at audit time or when the GRC team comes asking.',
  },
  {
    icon: FiCompass, accent: 'navy', title: 'Scoped to what applies',
    body: 'Global, division, company, and conditional policies mean each business is measured against exactly the controls that apply to it — nothing more, nothing less.',
  },
];

// ---- Page ------------------------------------------------------------------

export function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, isVerified } = useAuthStore();
  const authed = isAuthenticated() && isVerified();

  const joinAscoe = () => (authed ? navigate('/dashboard') : navigate('/register'));

  return (
    <div className="w-full">
      {/* ============================ HERO ============================ */}
      <section className="relative w-full overflow-hidden">
        {/* glows */}
        <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-grape-500/15 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 pt-24 pb-20 sm:pt-28 sm:pb-24 text-center">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/15 backdrop-blur-sm">
            <OrbitMark size={44} />
          </div>
          <Eyebrow className="mb-5">AppSec Center of Excellence · Powered by Orbit</Eyebrow>
          <h1 className="mx-auto max-w-4xl text-4xl sm:text-6xl font-bold tracking-tight text-gray-900 leading-[1.05]">
            Security that scales with{' '}
            <span className="bg-gradient-to-r from-blue-500 to-grape-500 bg-clip-text text-transparent">
              development velocity
            </span>
            .
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl leading-relaxed text-gray-600">
            ASCOE embeds application security into how Hearst teams already build software — connecting
            inventory, pipelines, standards, and AI-assisted workflows into one continuous, governed
            lifecycle. So teams ship faster <em className="not-italic text-gray-800 font-medium">and</em> safer.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={joinAscoe}>
              {authed ? 'Go to your dashboard' : 'Join ASCOE'} <FiArrowRight />
            </Button>
            <a
              href="#lifecycle"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-base font-semibold text-gray-800 transition-colors hover:bg-white/5"
            >
              See how it works <FiArrowDown />
            </a>
          </div>
          <p className="mt-10 text-sm font-medium text-gray-500">
            Security becomes part of the development process — not a gate at the end.
          </p>
        </div>
      </section>

      {/* ======================= WHY THIS MATTERS ======================= */}
      <Section id="why" bleed="surface">
        <SectionHeading
          eyebrow="The problem"
          title="Application risk you can't see is risk you can't manage."
          sub="Without a shared program, security stays inconsistent and invisible — until it shows up in production. ASCOE changes the default."
        />
        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          {/* challenges */}
          <div className="space-y-3">
            {CHALLENGES.map((row) => (
              <div key={row.c} className="flex items-stretch gap-3">
                <div className="flex flex-1 items-center gap-3 rounded-xl bg-surface border border-white/[0.06] px-4 py-3.5">
                  <FiAlertTriangle className="shrink-0 text-amber-500" />
                  <span className="text-sm font-medium text-gray-800">{row.c}</span>
                </div>
                <div className="flex items-center text-gray-500"><FiArrowRight /></div>
                <div className="flex flex-1 items-center rounded-xl border border-white/[0.04] bg-field px-4 py-3.5">
                  <span className="text-sm text-gray-600">{row.i}</span>
                </div>
              </div>
            ))}
          </div>
          {/* future state */}
          <div className="rounded-2xl bg-gradient-to-br from-navy-800/60 to-blue-950/40 border border-blue-500/20 p-8">
            <div className="mb-5 flex items-center gap-3">
              <IconBadge icon={FiShield} accent="teal" />
              <h3 className="text-lg font-semibold text-gray-900">A standardized application security lifecycle that delivers:</h3>
            </div>
            <ul className="space-y-3">
              {FUTURE_STATE.map((f) => (
                <li key={f} className="flex items-center gap-3 text-gray-700">
                  <FiCheckCircle className="shrink-0 text-brandgreen-500" /> <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-10 flex items-center justify-center gap-3 rounded-2xl bg-navy-800/50 border border-white/[0.06] px-6 py-5 text-center">
          <FiTrendingUp className="text-blue-700" />
          <p className="text-base font-semibold text-gray-900">Security scales with development velocity.</p>
        </div>
      </Section>

      {/* ======================= GOALS & OUTCOMES ======================= */}
      <Section id="goals">
        <SectionHeading
          eyebrow="One program, three goals"
          title="Visibility, assurance, and governance — by design."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {GOALS.map((g) => (
            <div key={g.title} className="rounded-2xl bg-surface border border-white/[0.06] p-8 transition-all hover:border-white/15 hover:-translate-y-0.5">
              <IconBadge icon={g.icon} accent={g.accent} size="lg" />
              <h3 className="mt-5 text-xl font-semibold text-gray-900">{g.title}</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">{g.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-14 mb-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
          The business outcomes
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {OUTCOMES.map((o) => (
            <div key={o.label} className="flex flex-col items-center gap-3 rounded-xl bg-surface/60 border border-white/[0.05] px-4 py-6 text-center">
              <o.icon className="text-blue-700" size={22} />
              <span className="text-sm font-medium text-gray-700">{o.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ========================= LIFECYCLE ========================= */}
      <Section id="lifecycle" bleed="surface">
        <SectionHeading
          eyebrow="How it works"
          title="One security lifecycle, six phases, always improving."
          sub="Security is built into every stage of delivery — and each phase is accelerated by a purpose-built AI harness, with humans in the loop."
        />
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {PHASES.map((p) => {
            const a = ACCENT[p.accent] ?? ACCENT.teal;
            return (
              <div key={p.n} className="relative overflow-hidden rounded-2xl bg-surface border border-white/[0.06] p-6">
                <span className={`absolute left-0 top-0 h-full w-1 ${a.bar}`} />
                <div className="flex items-baseline gap-3">
                  <span className={`text-2xl font-bold ${a.text}`}>{p.n}</span>
                  <h3 className="text-lg font-semibold text-gray-900">{p.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{p.body}</p>
                <p className="mt-4 flex items-start gap-2 border-t border-white/[0.06] pt-3 text-xs text-gray-500">
                  <FiCpu className={`mt-0.5 shrink-0 ${a.text}`} size={14} />
                  <span>{p.ai}</span>
                </p>
              </div>
            );
          })}
        </div>
        <div className="mt-8 flex items-center justify-center gap-3 rounded-full bg-navy-800/50 border border-white/[0.06] px-6 py-3 text-center">
          <FiRefreshCw className="text-blue-700" />
          <p className="text-sm font-medium text-gray-700">
            <span className="text-gray-900 font-semibold">Continuous improvement</span> — phase 06 governs and feeds back into all phases.
          </p>
        </div>
      </Section>

      {/* ======================= OPERATING MODEL ======================= */}
      <Section id="operating-model">
        <SectionHeading
          eyebrow="Security as an enabler"
          title="A partnership, not a gate."
        />
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-surface border border-white/[0.06] p-8">
            <div className="mb-5 flex items-center gap-3">
              <IconBadge icon={FiShield} accent="navy" />
              <h3 className="text-lg font-semibold text-gray-900">Central AppSec <span className="text-gray-500 font-normal">(HTS AppSec)</span></h3>
            </div>
            <ul className="space-y-3">
              {['Policy & standards', 'Security tooling', 'Governance & reporting', 'Program oversight'].map((x) => (
                <li key={x} className="flex items-center gap-3 text-gray-700"><FiCheckCircle className="shrink-0 text-navy-300" />{x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-surface border border-white/[0.06] p-8">
            <div className="mb-5 flex items-center gap-3">
              <IconBadge icon={FiUsers} accent="teal" />
              <h3 className="text-lg font-semibold text-gray-900">Business engineering teams</h3>
            </div>
            <ul className="space-y-3">
              {['Execute security practices', 'Remediate findings', 'Maintain evidence', 'Own application risk'].map((x) => (
                <li key={x} className="flex items-center gap-3 text-gray-700"><FiCheckCircle className="shrink-0 text-blue-700" />{x}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 rounded-2xl bg-navy-800/50 border border-white/[0.06] px-6 py-6 text-center">
          <span className="text-sm font-semibold text-gray-800">Central security team</span>
          <span className="text-2xl font-bold text-blue-700">+</span>
          <span className="text-sm font-semibold text-gray-800">Business engineering teams</span>
          <span className="text-2xl font-bold text-blue-700">=</span>
          <span className="text-sm font-bold text-brandgreen-500">Secure software delivery</span>
        </div>
        <p className="mt-6 text-center text-gray-500">
          The program is designed to support development teams — not act as a gatekeeper.
        </p>
      </Section>

      {/* ===================== AI-ENABLED HARNESS ===================== */}
      <Section id="ai" bleed="navy">
        <SectionHeading
          eyebrow="AI-enabled AppSec"
          title="AI moves faster when it's surrounded by context, standards, and human judgment."
          sub="We don't just point AI at code. The program gives AI the application context, control model, and evidence it needs to produce security insight teams can actually trust."
        />

        {/* three legs */}
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            { icon: FiDatabase, accent: 'teal', title: 'Context', body: 'Application inventory, owners, risk tiers, exposure, and data classification.' },
            { icon: FiLayers, accent: 'grape', title: 'Control model', body: 'Security standards, CI gates, severity policy, exceptions, and release evidence.' },
            { icon: FiCpu, accent: 'green', title: 'AI acceleration', body: 'Agentic triage, remediation guidance, evidence summaries, and workflow automation.' },
          ].map((leg) => (
            <div key={leg.title} className="rounded-2xl bg-surface border border-white/[0.06] p-7">
              <IconBadge icon={leg.icon} accent={leg.accent} />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{leg.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{leg.body}</p>
            </div>
          ))}
        </div>

        {/* harness I/O diagram */}
        <div className="mt-8 rounded-2xl bg-surface border border-white/[0.06] p-6 sm:p-8">
          <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Inputs</p>
              <div className="space-y-2">
                {HARNESS_INPUTS.map((x) => (
                  <div key={x} className="rounded-lg bg-field border border-white/[0.05] px-3 py-2 text-sm text-gray-700">{x}</div>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-3">
              <FiArrowRight className="hidden lg:block text-gray-500" size={22} />
              <FiArrowDown className="lg:hidden text-gray-500" size={22} />
              <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-gradient-to-br from-blue-600/25 to-grape-600/25 ring-1 ring-blue-500/30 text-center">
                <FiCpu className="text-blue-700" size={26} />
                <span className="mt-1 px-2 text-sm font-bold leading-tight text-gray-900">AI Security Harness</span>
              </div>
              <FiArrowRight className="hidden lg:block text-gray-500" size={22} />
              <FiArrowDown className="lg:hidden text-gray-500" size={22} />
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Outputs</p>
              <div className="space-y-2">
                {HARNESS_OUTPUTS.map((x) => (
                  <div key={x} className="rounded-lg bg-blue-600/10 border border-blue-500/20 px-3 py-2 text-sm text-gray-700">{x}</div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-6 border-t border-white/[0.06] pt-4 text-center text-sm text-gray-500">
            The harness makes AI useful by surrounding it with context, policy, workflow, and human validation.
          </p>
        </div>

        {/* guardrail hierarchy */}
        <div className="mt-8">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            From data to AI-ready guardrails
          </p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            {GUARDRAILS.map((g, idx) => (
              <div key={g.title} className="flex flex-1 items-center gap-3 lg:flex-col lg:gap-0">
                <div className="flex-1 rounded-xl bg-surface border border-white/[0.06] p-4 text-center h-full">
                  <p className="text-sm font-semibold text-gray-900">{g.title}</p>
                  <p className="mt-1 text-xs leading-snug text-gray-500">{g.body}</p>
                </div>
                {idx < GUARDRAILS.length - 1 && (
                  <>
                    <FiArrowRight className="hidden lg:block text-gray-500 mx-1" />
                    <FiArrowDown className="lg:hidden text-gray-500" />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-gray-600">
          AI helps the program move faster. The AppSec process makes AI's output useful, auditable, and
          connected to how Hearst teams actually deliver software.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600/15 to-grape-600/15 border border-blue-500/20 px-6 py-5 text-center">
          <FiZap className="text-blue-700" />
          <p className="text-base font-semibold text-gray-900">
            An AI-enabled secure software factory — with human judgment, business ownership, and measurable assurance.
          </p>
        </div>
      </Section>

      {/* =========================== SAMM =========================== */}
      <Section id="samm">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <SectionHeading
              eyebrow="Aligned to industry standards"
              title="Built on OWASP SAMM."
              sub="The program maps directly to a recognized maturity model — so progress is measurable and comparable across every business unit."
              center={false}
            />
            <div className="mt-8 flex flex-wrap gap-2.5">
              {SAMM_BENEFITS.map((b) => (
                <span key={b} className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 border border-blue-500/20 px-3.5 py-1.5 text-sm font-medium text-gray-700">
                  <FiCheckCircle className="text-brandgreen-500" size={15} /> {b}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl bg-surface border border-white/[0.06]">
            <div className="grid grid-cols-2 bg-navy-800/60 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <span>Program lifecycle</span>
              <span>SAMM domain</span>
            </div>
            {SAMM_MAP.map((row, i) => (
              <div key={row.phase} className={`grid grid-cols-2 items-center px-6 py-3.5 text-sm ${i % 2 ? 'bg-white/[0.02]' : ''}`}>
                <span className="font-medium text-gray-800">{row.phase}</span>
                <span className="text-gray-600">{row.domain}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* =========================== ASCOE =========================== */}
      <Section id="ascoe" bleed="surface">
        <SectionHeading
          eyebrow="Connect · Collaborate · Elevate · Secure"
          title="The AppSec Center of Excellence."
          sub="A community of developers and security leaders driving secure software delivery across Hearst — through knowledge sharing, collaboration, and shared visibility in Orbit."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {ASCOE_PILLARS.map((p) => (
            <div key={p.title} className="flex flex-col rounded-2xl bg-surface border border-white/[0.06] p-8">
              <IconBadge icon={p.icon} accent={p.accent} size="lg" />
              <h3 className="mt-5 text-lg font-semibold text-gray-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{p.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-grape-600/10 border border-grape-500/20 px-6 py-4 text-center">
          <FiBookOpen className="text-grape-600" />
          <p className="text-sm font-medium text-gray-700">
            Every member gets a shared library of best practices, standards, and guidelines.
          </p>
        </div>
      </Section>

      {/* =========================== ATLAS =========================== */}
      <Section id="atlas">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex items-center gap-2.5">
            <OrbitMark size={34} />
            <span className="text-2xl font-bold tracking-tight text-gray-900">Orbit</span>
          </div>
          <SectionHeading
            eyebrow="The platform behind the program"
            title="Map your application security journey."
            sub="The single source of truth for application security across Hearst — and the signal layer that feeds every AI harness."
          />
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ATLAS_PILLARS.map((p) => (
            <div key={p.title} className="rounded-2xl bg-surface border border-white/[0.06] p-7 transition-all hover:border-white/15 hover:-translate-y-0.5">
              <IconBadge icon={p.icon} accent={p.accent} />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{p.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-12 text-center text-xl font-semibold tracking-tight text-gray-900">
          One platform. One inventory.{' '}
          <span className="bg-gradient-to-r from-blue-500 to-grape-500 bg-clip-text text-transparent">One security story.</span>
        </p>
      </Section>

      {/* ==================== POLICY COMPLIANCE ==================== */}
      <Section id="compliance" bleed="surface">
        <SectionHeading
          eyebrow="Continuous compliance"
          title="Know your InfoSec policy compliance — on demand, all the time."
          sub="Orbit turns the software-development and application-security portions of your Information Security Policy into controls it grades every application against — automatically, and always current. Not once a year at audit time. Any time you look."
        />
        <div className="mt-14 grid gap-8 lg:grid-cols-2 lg:items-center">
          {/* live compliance card */}
          <div className="rounded-2xl bg-surface border border-white/[0.06] p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FiShield className="text-blue-700" />
                <span className="text-sm font-semibold text-gray-900">InfoSec Policy Compliance</span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-600/10 border border-green-500/20 px-2.5 py-1 text-xs font-medium text-brandgreen-500">
                <span className="h-1.5 w-1.5 rounded-full bg-brandgreen-500" /> Live
              </span>
            </div>
            <div className="my-7">
              <Gauge value={87} label="Policy adherence" />
            </div>
            <div className="space-y-2.5">
              {[
                { k: 'Applications with compliant policies', v: '96 of 128' },
                { k: 'Policies evaluated', v: '6' },
                { k: 'Controls met', v: '1,204 of 1,384' },
                { k: 'Policy exceptions tracked', v: '4' },
              ].map((r) => (
                <div key={r.k} className="flex items-center justify-between rounded-lg bg-field border border-white/[0.05] px-4 py-2.5 text-sm">
                  <span className="text-gray-600">{r.k}</span>
                  <span className="font-semibold text-gray-900">{r.v}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-xs text-gray-500">
              Illustrative — the same view is live in the Orbit executive dashboard.
            </p>
          </div>
          {/* points */}
          <div className="space-y-5">
            {COMPLIANCE_POINTS.map((p) => (
              <div key={p.title} className="flex gap-4">
                <span className="shrink-0"><IconBadge icon={p.icon} accent={p.accent} /></span>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 flex items-center justify-center gap-3 rounded-2xl bg-navy-800/50 border border-white/[0.06] px-6 py-5 text-center">
          <FiClipboard className="shrink-0 text-blue-700" />
          <p className="text-sm font-medium text-gray-700">
            Every control result carries the evidence behind it — and tracked exceptions — giving your GRC and
            internal-audit teams a clear, current picture across the entire portfolio.
          </p>
        </div>
      </Section>

      {/* ========================= FINAL CTA ========================= */}
      <section className="relative w-full overflow-hidden border-t border-white/[0.06]">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">Build secure software, together.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
            Join the AppSec Center of Excellence — powered by Orbit.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={joinAscoe}>
              {authed ? 'Go to your dashboard' : 'Join ASCOE'} <FiArrowRight />
            </Button>
            <a
              href="mailto:appsec@hearst.com"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-base font-semibold text-gray-800 transition-colors hover:bg-white/5"
            >
              Talk to the AppSec team
            </a>
          </div>
        </div>
      </section>

      {/* =========================== FOOTER =========================== */}
      <footer className="w-full border-t border-white/[0.06] bg-navy-950/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <OrbitMark size={26} />
            <span className="text-sm font-semibold text-gray-800">Orbit</span>
            <span className="text-sm text-gray-500">· HEARST</span>
          </div>
          <p className="text-sm text-gray-500">
            Delivering secure software, together — powered by Orbit.
          </p>
        </div>
      </footer>
    </div>
  );
}
