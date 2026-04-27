import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';

export function ScoreCard({ knowledgeScore, toolScore, totalScore, breakdown, onMarkReviewed, isAdmin, lastReviewed, showBreakdownByDefault = false }) {
  const [showBreakdown, setShowBreakdown] = useState(showBreakdownByDefault);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);

  const isToolStatusQuickWin = (status) =>
    status === 'missing' ||
    status === 'low' ||
    status === 'missing-scan' ||
    status === 'stale';

  // Check if Quick Wins section should be shown
  const hasQuickWins = breakdown && (() => {
    const recommendations = [];
    if (breakdown.tools) {
      if (breakdown.tools.some(t => isToolStatusQuickWin(t.status))) {
        recommendations.push({});
      }
    }
    if (breakdown.knowledgeSharing?.missingFields && breakdown.knowledgeSharing.missingFields.length > 0) {
      recommendations.push({});
    }
    if (breakdown.reviewRecommendation && recommendations.length < 2) {
      recommendations.push({});
    }
    return recommendations.length > 0 || toolScore === 0;
  })();

  const getScoreColor = (score) => {
    if (score >= 76) return 'text-green-600';
    if (score >= 51) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score) => {
    if (score >= 76) return 'bg-green-100';
    if (score >= 51) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getBarColor = (score, maxScore) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 76) return 'bg-green-500';
    if (percentage >= 51) return 'bg-yellow-500';
    if (percentage >= 26) return 'bg-orange-500';
    return 'bg-red-600';
  };

  const handleMarkReviewed = async () => {
    try {
      setMarkingReviewed(true);
      await onMarkReviewed();
      setShowReviewModal(false);
    } catch (error) {
      console.error('Failed to mark as reviewed:', error);
    } finally {
      setMarkingReviewed(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Application Security Score</CardTitle>
              <Link
                to="/docs/scoring-methodology"
                className="text-xs text-blue-600 hover:text-blue-700 mt-1 block"
                target="_blank"
              >
                How is this calculated? →
              </Link>
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReviewModal(true)}
              >
                Mark as Reviewed
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-1 gap-6 ${hasQuickWins ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {/* Column 1 - Score Display */}
            <div>
              <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg p-5 border-2 border-gray-200 shadow-sm h-full">
                <div className="text-center md:text-left">
                  <div className={`text-5xl font-bold ${getScoreColor(totalScore)} mb-2`}>
                    {totalScore}
                  </div>
                  <div className="text-sm text-gray-600 mb-4">out of 100</div>
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getScoreBgColor(totalScore)} ${getScoreColor(totalScore)}`}>
                    {totalScore >= 76 ? 'Excellent' : totalScore >= 51 ? 'Good' : 'Needs Improvement'}
                  </div>

                  {/* Category Scores */}
                  <div className="mt-6 space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Knowledge Sharing</span>
                      <span className="font-medium">
                        {knowledgeScore}
                        {breakdown?.importance && (
                          <span className="text-xs text-gray-500">
                            /{Math.round(50 * (breakdown.importance.knowledgeWeight || 0.5) * 2)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${getBarColor(
                          knowledgeScore, 
                          breakdown?.importance 
                            ? 50 * (breakdown.importance.knowledgeWeight || 0.5) * 2
                            : 50
                        )}`}
                        style={{ 
                          width: `${breakdown?.importance 
                            ? (knowledgeScore / (50 * (breakdown.importance.knowledgeWeight || 0.5) * 2)) * 100 
                            : (knowledgeScore / 50) * 100}%`,
                          minWidth: knowledgeScore > 0 ? '4px' : '0px'
                        }}
                      />
                    </div>
                    {breakdown?.knowledgeSharing && (
                      <div className="text-xs text-gray-600 mt-1.5">
                        {breakdown.knowledgeSharing.fieldsFilled ?? 0} of {breakdown.knowledgeSharing.totalFields ?? 0} fields filled
                        {breakdown.knowledgeSharing.lastReviewed ? (
                          <span className="text-gray-500"> • Last reviewed {new Date(breakdown.knowledgeSharing.lastReviewed).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-yellow-600"> • {isAdmin ? 'Not yet reviewed' : 'Pending review'}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Tool Usage</span>
                      <span className="font-medium">
                        {toolScore}
                        {breakdown?.importance && (
                          <span className="text-xs text-gray-500">
                            /{Math.round(50 * (breakdown.importance.toolWeight || 0.5) * 2)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${getBarColor(
                          toolScore,
                          breakdown?.importance 
                            ? 50 * (breakdown.importance.toolWeight || 0.5) * 2
                            : 50
                        )}`}
                        style={{ 
                          width: `${breakdown?.importance 
                            ? (toolScore / (50 * (breakdown.importance.toolWeight || 0.5) * 2)) * 100 
                            : (toolScore / 50) * 100}%`,
                          minWidth: toolScore > 0 ? '4px' : '0px'
                        }}
                      />
                    </div>
                    {breakdown && (
                      <div className="text-xs text-gray-600 mt-1.5 space-y-0.5">
                        {(breakdown.configuredTools?.length ?? 0) > 0 && (
                          <div>Security tools: {breakdown.configuredTools.join(', ')}</div>
                        )}
                        {(breakdown.notApplicableToolCategories?.length ?? 0) > 0 && (
                          <div className="text-gray-500">
                            Not required (N/A): {breakdown.notApplicableToolCategories.join(', ')}
                          </div>
                        )}
                        {(breakdown.configuredTools?.length ?? 0) === 0 &&
                          (breakdown.notApplicableToolCategories?.length ?? 0) === 0 && (
                            <div>No security tools configured</div>
                          )}
                      </div>
                    )}
                  </div>
                </div>
                </div>
              </div>
            </div>

            {/* Column 2 - Criticality Information */}
            {breakdown?.importance && (
              <div>
                <div className="bg-gradient-to-br from-purple-50/50 via-pink-50/50 to-red-50/50 rounded-lg p-5 border-2 border-purple-100 shadow-sm h-full">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm font-bold text-purple-900">Application Criticality</div>
                  </div>
                  <div className="text-base font-semibold text-gray-900 mb-4 leading-tight">
                    {breakdown.importance.importanceScore < 0.33 
                      ? 'Lower priority application: Focus on documentation and data sharing'
                      : breakdown.importance.importanceScore < 0.67
                      ? 'Standard application: Balanced focus on documentation and security tools'
                      : 'Critical application: Emphasis on security tooling and active protection'}
                  </div>
                  {breakdown.importance.importanceFactors && breakdown.importance.importanceFactors.length > 0 && (
                    <div className="text-xs text-gray-700 mt-4 pt-4 border-t border-purple-100">
                      <div className="font-semibold text-gray-800 mb-2.5">Based on:</div>
                      <div className="space-y-2">
                        {breakdown.importance.importanceFactors
                          .filter(factor => {
                            if (factor.type === 'facing' && factor.value === 'Internal') return false;
                            if (factor.type === 'interfaces' && factor.value === 0) return false;
                            if (factor.type === 'dataTypes' && !factor.contributed) return false;
                            return true;
                          })
                          .map((factor, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="text-purple-500 mt-0.5 font-bold">•</span>
                              <span className={factor.description.includes('assumed') ? 'text-gray-500 italic' : 'text-gray-800'}>
                                {factor.description}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Column 3 - Quick Wins */}
            {breakdown && (() => {
                  const recommendations = [];
                  
                  // Priority 1: Missing tool + level, or (if none) first scan / staleness issue — includes SCA, SAST, DAST, etc.
                  if (breakdown.tools) {
                    const missingTools = breakdown.tools.filter(t => t.status === 'missing');
                    if (missingTools.length > 0) {
                      let message = '';
                      if (missingTools.length === 1) {
                        message = `Add a ${missingTools[0].category} tool`;
                      } else if (missingTools.length === 2) {
                        message = `Add a ${missingTools[0].category} and ${missingTools[1].category} tool`;
                      } else {
                        message = `Add a ${missingTools[0].category} and other security tools`;
                      }
                      recommendations.push({
                        priority: 1,
                        type: 'tool',
                        message: message,
                        impact: 'This will significantly improve your security score',
                      });
                    } else {
                      const scanOrStale = breakdown.tools.filter(
                        t => t.status === 'missing-scan' || t.status === 'stale',
                      );
                      if (scanOrStale.length > 0) {
                        const first = scanOrStale[0];
                        const label = first.category || 'Security';
                        const message =
                          first.recommendation ||
                          (first.status === 'stale'
                            ? `Update ${label} to align with deployments`
                            : `Add a ${label} scan date`);
                        recommendations.push({
                          priority: 1,
                          type: 'tool',
                          message,
                          impact: 'Updating scan dates and integration levels is a quick way to raise your tool score',
                        });
                      }
                    }
                  }

                  // Priority 2: Missing knowledge fields (easy win)
                  if (breakdown.knowledgeSharing?.missingFields && breakdown.knowledgeSharing.missingFields.length > 0) {
                    const missingCount = breakdown.knowledgeSharing.missingFields.length;
                    const firstField = breakdown.knowledgeSharing.missingFields[0];
                    const knowledgeWeight = breakdown.importance?.knowledgeWeight || 0.5;
                    const weightedPoints = Math.round(missingCount * 5 * knowledgeWeight * 2);
                    recommendations.push({
                      priority: 2,
                      type: 'knowledge',
                      message: `Fill in ${firstField}${missingCount > 1 ? ` and ${missingCount - 1} other field${missingCount > 2 ? 's' : ''}` : ''} to help us better understand your application`,
                      impact: `Quick win: adds ${weightedPoints} point${weightedPoints !== 1 ? 's' : ''} to your score`,
                    });
                  }

                  // Priority 3: Low integration levels
                  if (breakdown.tools) {
                    const lowIntegration = breakdown.tools.find(t => t.status === 'low');
                    if (lowIntegration) {
                      recommendations.push({
                        priority: 3,
                        type: 'tool',
                        message: `Improve ${lowIntegration.category} integration level`,
                        impact: 'Better integration means better visibility and higher scores',
                      });
                    }
                  }

                  // Priority 4: Review needed
                  if (breakdown.reviewRecommendation && recommendations.length < 2) {
                    const knowledgeWeight = breakdown.importance?.knowledgeWeight || 0.5;
                    const maxWeightedReviewPoints = Math.round(10 * knowledgeWeight * 2);
                    recommendations.push({
                      priority: 4,
                      type: 'review',
                      message: 'Request a metadata review from the AppSec team to verify your information is up to date',
                      impact: `Recent reviews can add up to ${maxWeightedReviewPoints} points`,
                    });
                  }

                  const topRecommendations = recommendations.slice(0, 3);

                  // If no recommendations but tool score is 0, show a helpful message
                  if (topRecommendations.length === 0 && toolScore === 0) {
                    return (
                      <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-lg p-5 border-2 border-blue-100 shadow-sm h-full">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <div className="font-semibold text-blue-900 text-sm">Quick Wins</div>
                        </div>
                        <div className="text-xs text-gray-700">
                          <div className="flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5 font-bold">•</span>
                            <div>
                              <div className="font-medium">Set up security tools (SAST, SCA, DAST, WAF, or API Security) to start earning points</div>
                              <div className="text-gray-600 text-xs mt-1">Each tool you configure will improve your security score</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (topRecommendations.length === 0 && toolScore > 0) {
                    return null;
                  }

                  return (
                    <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-lg p-5 border-2 border-blue-100 shadow-sm h-full">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <div className="font-semibold text-blue-900 text-sm">Quick Wins</div>
                      </div>
                      <div className="space-y-3 text-xs">
                        {topRecommendations.map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-gray-800 rounded-md p-2.5">
                            <span className="text-blue-600 mt-0.5 font-bold text-base">•</span>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{rec.message}</div>
                              <div className="text-blue-700 text-xs mt-1 font-medium">{rec.impact}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
          </div>
        </CardContent>
      </Card>

      {/* Review Modal */}
      {showReviewModal && (
        <Modal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          title="Mark Metadata as Reviewed"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              This will mark the application's metadata as reviewed and update the knowledge sharing score.
              The review date will be set to today.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowReviewModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleMarkReviewed}
                loading={markingReviewed}
              >
                Mark as Reviewed
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

