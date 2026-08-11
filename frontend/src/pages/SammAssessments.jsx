import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import useAuthStore from '../store/authStore.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Button } from '../components/ui/Button.jsx';

const hasAnswer = (answers, questionId) => Object.prototype.hasOwnProperty.call(answers || {}, questionId);
const practiceComplete = (practice, responses) => practice.questions?.length === 2
  && practice.questions.every((question) => hasAnswer(responses[practice.id]?.answers, question.id));
const approvedAnswers = (practice, responses) => Object.fromEntries((practice.questions || [])
  .filter((question) => hasAnswer(responses[practice.id]?.answers, question.id))
  .map((question) => [question.id, responses[practice.id].answers[question.id]]));

export function SammAssessments() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [framework, setFramework] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPracticeIndex, setCurrentPracticeIndex] = useState(0);
  const positioned = useRef(false);
  const queryCompanyId = searchParams.get('companyId') || '';
  const isNewAssessment = searchParams.get('new') === '1';

  const practices = useMemo(() => framework?.practices || [], [framework]);
  const currentPractice = practices[currentPracticeIndex];
  const currentResponse = currentPractice ? responses[currentPractice.id] || {} : {};
  const completedPracticeCount = practices.filter((practice) => practiceComplete(practice, responses)).length;
  const currentDomainId = currentPractice?.domain.id;
  const readOnly = assessment?.status !== 'draft';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const currentFramework = await api.getSammFramework();
        if (cancelled) return;
        setFramework(currentFramework);

        if (!id && queryCompanyId && isNewAssessment) {
          const existingAssessments = await api.getSammAssessments(queryCompanyId);
          const draft = (existingAssessments || []).find((item) => item.status === 'draft');
          const nextAssessment = draft || await api.createSammAssessment(queryCompanyId);
          if (!cancelled) navigate(`/samm-assessments/${nextAssessment.id}`, { replace: true });
          return;
        }

        if (id) {
          const currentAssessment = await api.getSammAssessment(id);
          if (!cancelled) {
            setAssessment(currentAssessment);
            setResponses(Object.fromEntries((currentAssessment.responses || []).map((response) => [response.practiceId, response])));
          }
        } else if (!queryCompanyId) {
          navigate(user?.companyId ? `/companies/${user.companyId}` : '/companies', { replace: true });
        }
      } catch (error) {
        if (!cancelled) toast.error(error.message || 'Failed to load SAMM assessment');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, queryCompanyId, isNewAssessment]);

  useEffect(() => {
    if (positioned.current || !practices.length || !assessment) return;
    const firstIncomplete = practices.findIndex((practice) => !practiceComplete(practice, responses));
    setCurrentPracticeIndex(firstIncomplete === -1 ? 0 : firstIncomplete);
    positioned.current = true;
  }, [assessment, practices, responses]);

  const save = async (status = 'draft', responseSet = responses) => {
    if (!assessment) return false;
    setSaving(true);
    try {
      const saved = await api.saveSammAssessment(assessment.id, {
        status,
        ownerName: assessment.ownerName || '',
        notes: assessment.notes || '',
        responses: practices.map((practice) => ({
          practiceId: practice.id,
          answers: approvedAnswers(practice, responseSet),
          rationale: responseSet[practice.id]?.rationale || '',
          evidenceReference: responseSet[practice.id]?.evidenceReference || '',
        })),
      });
      setAssessment(saved);
      setResponses(Object.fromEntries((saved.responses || []).map((response) => [response.practiceId, response])));
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to save assessment');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const selectAnswer = async (questionId, value) => {
    if (!currentPractice || readOnly || saving) return;
    const existing = responses[currentPractice.id] || { practiceId: currentPractice.id };
    const nextResponses = {
      ...responses,
      [currentPractice.id]: {
        ...existing,
        answers: { ...(existing.answers || {}), [questionId]: value },
      },
    };
    setResponses(nextResponses);
    await save('draft', nextResponses);
  };

  const continueAssessment = async () => {
    if (!practiceComplete(currentPractice, responses)) {
      toast.error('Answer both questions before continuing');
      return;
    }
    const isLastPractice = currentPracticeIndex === practices.length - 1;
    const saved = await save(isLastPractice ? 'completed' : 'draft');
    if (!saved) return;
    if (isLastPractice) toast.success('SAMM-aligned assessment submitted');
    else setCurrentPracticeIndex((index) => index + 1);
  };

  if (loading) return <LoadingPage message="Loading maturity assessment..." />;

  const companyId = assessment?.company?.id || queryCompanyId;
  const exitPath = companyId ? `/companies/${companyId}` : '/dashboard';
  const goToDomain = (domainId) => {
    const firstIncomplete = practices.findIndex((practice) => practice.domain.id === domainId
      && !practiceComplete(practice, responses));
    const firstPractice = practices.findIndex((practice) => practice.domain.id === domainId);
    setCurrentPracticeIndex(firstIncomplete === -1 ? firstPractice : firstIncomplete);
  };

  if (!currentPractice?.questions?.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Assessment unavailable</h1>
        <p className="mt-3 text-sm text-gray-600">The Atlas API did not return the approved maturity question bank. Restart the backend and refresh this page.</p>
        <Link to={exitPath} className="mt-6 inline-block text-sm font-medium text-blue-700 hover:text-blue-800">Exit assessment</Link>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium text-gray-600">{assessment?.company?.name || 'Company'} · Atlas SAMM-aligned assessment</span>
          <Link to={exitPath} className="text-blue-700 hover:text-blue-800">Save & finish later</Link>
        </div>
        <div className="mt-5 flex items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-field">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${practices.length ? (completedPracticeCount / practices.length) * 100 : 0}%` }} />
          </div>
          <span className="whitespace-nowrap text-xs font-medium text-gray-500">Practice {currentPracticeIndex + 1} of {practices.length}</span>
        </div>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-white/10 bg-surface p-3 shadow-lg shadow-black/20">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Progress</p>
          <div className="space-y-1">
            {(framework?.domains || []).map((domain) => {
              const completed = domain.practices.filter((practice) => practiceComplete(practice, responses)).length;
              const active = domain.id === currentDomainId;
              return (
                <button key={domain.id} type="button" onClick={() => goToDomain(domain.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${active ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-surface-2 hover:text-gray-900'}`}>
                  <span>{domain.name}</span>
                  <span className="text-xs opacity-70">{completed}/{domain.practices.length}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="overflow-hidden rounded-xl border border-white/10 bg-surface shadow-lg shadow-black/20">
          <div className="border-b border-white/10 bg-surface-2 px-5 py-4 sm:px-7">
            <p className="text-sm font-medium text-blue-700">{currentPractice.domain.name}</p>
            <h1 className="mt-1 text-xl font-semibold text-gray-900">{currentPractice.name}</h1>
          </div>

          <div className="space-y-7 px-5 py-7 sm:px-7 sm:py-8">
            {currentPractice.questions.map((question) => (
              <fieldset key={question.id}>
                <legend className="text-lg font-semibold leading-snug text-gray-900">{question.title}</legend>
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-blue-700">{question.streamName}</p>
                <div className="mt-4 space-y-2">
                  {question.choices.map((choice) => {
                    const selected = hasAnswer(currentResponse.answers, question.id)
                      && Number(currentResponse.answers[question.id]) === choice.value;
                    return (
                      <label key={choice.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-all ${selected ? 'border-blue-400 bg-blue-100 text-blue-900 shadow-sm' : 'border-white/10 bg-field text-gray-700 hover:border-blue-400/60 hover:bg-surface-2'} ${readOnly ? 'cursor-default' : ''}`}>
                        <input type="radio" name={question.id} checked={selected} disabled={readOnly || saving} onChange={() => selectAnswer(question.id, choice.value)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" />
                        <span className="leading-relaxed">{choice.text}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <footer className="flex items-center justify-between border-t border-white/10 bg-surface-2 px-5 py-4 sm:px-7">
            <Button variant="ghost" onClick={() => setCurrentPracticeIndex((index) => Math.max(0, index - 1))} disabled={saving || currentPracticeIndex === 0}>← Back</Button>
            {!readOnly ? (
              <Button onClick={continueAssessment} disabled={saving || !practiceComplete(currentPractice, responses)}>
                {saving ? 'Saving…' : currentPracticeIndex === practices.length - 1 ? 'Submit assessment' : 'Continue →'}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setCurrentPracticeIndex((index) => Math.min(practices.length - 1, index + 1))} disabled={currentPracticeIndex === practices.length - 1}>Next →</Button>
            )}
          </footer>
        </section>
      </div>
    </main>
  );
}
