import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';

export function ScoreCard({ knowledgeScore, toolScore, totalScore, breakdown, onMarkReviewed, isAdmin, lastReviewed, showBreakdownByDefault = false }) {
  const [showBreakdown, setShowBreakdown] = useState(showBreakdownByDefault);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Side - Score Display */}
            <div className="md:col-span-1">
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
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Breakdown */}
            {breakdown && (
              <div className="md:col-span-2">
                <div className="space-y-4 text-sm">
                  {/* Knowledge Sharing Breakdown */}
                  <div className="border-b pb-3">
                    <div className="font-medium text-gray-700 mb-1">Knowledge Sharing</div>
                    <div className="text-xs text-gray-600">
                      {breakdown.knowledgeSharing?.fieldsFilled || 0} of {breakdown.knowledgeSharing?.totalFields || 8} fields filled
                      {breakdown.knowledgeSharing?.lastReviewed ? (
                        <span className="text-gray-500"> • Last reviewed {new Date(breakdown.knowledgeSharing.lastReviewed).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-yellow-600"> • {isAdmin ? 'Not yet reviewed' : 'Pending review'}</span>
                      )}
                    </div>
                  </div>

                  {/* Tool Usage Breakdown */}
                  <div className="border-b pb-3">
                    <div className="font-medium text-gray-700 mb-1">Tool Usage</div>
                    <div className="text-xs text-gray-600">
                      {breakdown.configuredTools && breakdown.configuredTools.length > 0 ? (
                        `Security tools: ${breakdown.configuredTools.join(', ')}`
                      ) : (
                        'No security tools configured'
                      )}
                    </div>
                  </div>

                  {/* Recommendations Section - Only show top 2-3 suggestions */}
                  {(() => {
                    const recommendations = [];
                    
                    // Priority 1: Missing tools (highest impact)
                    if (breakdown.tools) {
                      const missingTools = breakdown.tools.filter(t => t.status === 'missing');
                      if (missingTools.length > 0) {
                        recommendations.push({
                          priority: 1,
                          type: 'tool',
                          message: `Set up ${missingTools[0].category} to automatically scan your code for vulnerabilities`,
                          impact: 'This will significantly improve your security score',
                        });
                      }
                    }

                    // Priority 2: Missing knowledge fields (easy win)
                    if (breakdown.knowledgeSharing?.missingFields && breakdown.knowledgeSharing.missingFields.length > 0) {
                      const missingCount = breakdown.knowledgeSharing.missingFields.length;
                      const firstField = breakdown.knowledgeSharing.missingFields[0];
                      // Each missing field adds 5 raw points, but we need to apply the knowledge weight
                      // Formula: rawPoints * knowledgeWeight * 2 (to scale to 100 point total)
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
                          message: `Improve ${lowIntegration.category} integration to share scan results with the security team`,
                          impact: 'Better integration means better visibility and higher scores',
                        });
                      }
                    }

                    // Priority 4: Review needed
                    if (breakdown.reviewRecommendation && recommendations.length < 2) {
                      // Review score is up to 10 raw points, weighted by knowledgeWeight
                      const knowledgeWeight = breakdown.importance?.knowledgeWeight || 0.5;
                      const maxWeightedReviewPoints = Math.round(10 * knowledgeWeight * 2);
                      recommendations.push({
                        priority: 4,
                        type: 'review',
                        message: 'Request a metadata review from the AppSec team to verify your information is up to date',
                        impact: `Recent reviews can add up to ${maxWeightedReviewPoints} points`,
                      });
                    }

                    // Only show top 2-3 recommendations
                    const topRecommendations = recommendations.slice(0, 3);

                    // Always show recommendations section if there are any, or if tool score is low
                    if (topRecommendations.length === 0 && toolScore > 0) {
                      return null;
                    }

                    // If no recommendations but tool score is 0, show a helpful message
                    if (topRecommendations.length === 0 && toolScore === 0) {
                      return (
                        <div className="border-b pb-3">
                          <div className="font-medium text-gray-700 mb-2">Quick Wins</div>
                          <div className="text-xs text-gray-700">
                            <div className="flex items-start gap-2">
                              <span className="text-blue-600 mt-0.5">•</span>
                              <div>
                                <div>Set up security tools (SAST, DAST, WAF, or API Security) to start earning points</div>
                                <div className="text-gray-500 text-xs mt-0.5">Each tool you configure will improve your security score</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="border-b pb-3">
                        <div className="font-medium text-gray-700 mb-2">Quick Wins</div>
                        <div className="space-y-2 text-xs">
                          {topRecommendations.map((rec, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-gray-700">
                              <span className="text-blue-600 mt-0.5">•</span>
                              <div className="flex-1">
                                <div>{rec.message}</div>
                                <div className="text-gray-500 text-xs mt-0.5">{rec.impact}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Importance Score Breakdown - Simplified */}
                  {breakdown?.importance && (
                    <div className="text-xs text-gray-500">
                      {breakdown.importance.importanceScore < 0.33 
                        ? 'Lower priority application: Focus on documentation and data sharing'
                        : breakdown.importance.importanceScore < 0.67
                        ? 'Standard application: Balanced focus on documentation and security tools'
                        : 'Critical application: Emphasis on security tooling and active protection'}
                    </div>
                  )}

                  {/* Link to full documentation */}
                  <div className="pt-2 border-t">
                    <Link
                      to="/docs/scoring-methodology"
                      className="text-blue-600 hover:text-blue-700 text-xs"
                      target="_blank"
                    >
                      View detailed scoring methodology →
                    </Link>
                  </div>
                </div>
              </div>
            )}
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

