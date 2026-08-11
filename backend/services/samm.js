import { prisma } from '../prisma/client.js';
import {
  ATLAS_SAMM_QUESTIONS,
  ATLAS_SAMM_QUESTION_BANK_VERSION,
} from '../data/atlasSammQuestionBank.js';

const SAMM_DOMAINS = [
  {
    key: 'governance', name: 'Governance', description: 'How software security is directed, measured, and supported.',
    practices: ['Strategy & Metrics', 'Policy & Compliance', 'Education & Guidance'],
  },
  {
    key: 'design', name: 'Design', description: 'How security is considered during design and architecture.',
    practices: ['Threat Assessment', 'Security Requirements', 'Security Architecture'],
  },
  {
    key: 'implementation', name: 'Implementation', description: 'How security is built, deployed, and defects are managed.',
    practices: ['Secure Build', 'Secure Deployment', 'Defect Management'],
  },
  {
    key: 'verification', name: 'Verification', description: 'How software security is assessed and tested.',
    practices: ['Architecture Assessment', 'Requirements-driven Testing', 'Security Testing'],
  },
  {
    key: 'operations', name: 'Operations', description: 'How security is managed in production and over the application lifecycle.',
    practices: ['Incident Management', 'Environment Management', 'Operational Management'],
  },
];

export async function ensureSammFramework() {
  const existing = await prisma.sammFramework.findFirst({
    where: { name: 'OWASP SAMM', version: '2.0', isActive: true },
    include: { domains: { include: { practices: true }, orderBy: { displayOrder: 'asc' } } },
  });
  if (existing) return existing;

  return prisma.sammFramework.create({
    data: {
      name: 'OWASP SAMM',
      version: '2.0',
      source: 'https://owaspsamm.org/model/',
      domains: {
        create: SAMM_DOMAINS.map((domain, domainIndex) => ({
          key: domain.key,
          name: domain.name,
          description: domain.description,
          displayOrder: domainIndex,
          practices: {
            create: domain.practices.map((name, practiceIndex) => ({
              key: `${domain.key}-${practiceIndex + 1}`,
              name,
              prompt: `Describe and score the current maturity of ${name} within ${domain.name}. Consider the SAMM v2 activities and outcomes for this practice.`,
              scoringGuidance: '0 = not assessed or not in place; 1 = initial implementation; 2 = structured realization; 3 = optimized operation.',
              displayOrder: practiceIndex,
              evidenceRequired: false,
            })),
          },
        })),
      },
    },
    include: { domains: { include: { practices: true }, orderBy: { displayOrder: 'asc' } } },
  });
}

export function flattenSammPractices(framework) {
  return (framework.domains || []).flatMap((domain) => (domain.practices || []).map((practice) => ({
    ...practice,
    questions: getAtlasSammQuestions(practice.key),
    questionBankVersion: ATLAS_SAMM_QUESTION_BANK_VERSION,
    domain: { id: domain.id, key: domain.key, name: domain.name },
  })));
}

export function getAtlasSammQuestions(practiceKey) {
  return ATLAS_SAMM_QUESTIONS[practiceKey] || [];
}

export function scoreAtlasSammPractice(practiceKey, answers) {
  const questions = getAtlasSammQuestions(practiceKey);
  if (questions.length !== 2 || !answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const scores = questions.map((question) => {
    if (!Object.prototype.hasOwnProperty.call(answers, question.id)) return null;
    const selected = Number(answers[question.id]);
    return question.choices.some((choice) => choice.value === selected) ? selected : null;
  });
  if (scores.some((score) => score === null)) return null;
  return Number(((scores[0] + scores[1]) / 2).toFixed(2));
}

export function summarizeSammAssessment(assessment) {
  const responses = assessment.responses || [];
  const scored = responses.filter((response) => response.score !== null && response.score !== undefined);
  const totalPractices = assessment.framework?.domains?.reduce(
    (total, domain) => total + (domain.practices?.length || 0), 0,
  ) || scored.length;
  const totalScore = scored.reduce((total, response) => total + response.score, 0);
  const averageScore = scored.length === totalPractices && totalPractices > 0
    ? Number((totalScore / totalPractices).toFixed(2))
    : null;
  return {
    totalPractices,
    assessedPractices: scored.length,
    averageScore,
    completionPercentage: totalPractices ? Math.round((scored.length / totalPractices) * 100) : 0,
  };
}
