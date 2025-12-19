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
              <CardTitle>Security Score</CardTitle>
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
                      <span className="font-medium">{knowledgeScore}/50</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getScoreBgColor(knowledgeScore)}`}
                        style={{ width: `${(knowledgeScore / 50) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Tool Usage</span>
                      <span className="font-medium">{toolScore}/50</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getScoreBgColor(toolScore)}`}
                        style={{ width: `${(toolScore / 50) * 100}%` }}
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
                    <div className="font-medium text-gray-700 mb-2">Knowledge Sharing ({knowledgeScore}/50 points)</div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Metadata Completeness:</span>
                        <span className="font-medium">
                          {breakdown.knowledgeSharing?.completenessScore || 0}/40 points
                        </span>
                      </div>
                      <div className="text-gray-500 pl-2">
                        {breakdown.knowledgeSharing?.fieldsFilled || 0} of {breakdown.knowledgeSharing?.totalFields || 8} fields filled
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-gray-600">Metadata Attestation:</span>
                        <span className="font-medium">
                          {breakdown.knowledgeSharing?.reviewScore || 0}/10 points
                        </span>
                      </div>
                      {breakdown.knowledgeSharing?.lastReviewed ? (
                        <div className="text-gray-500 pl-2">
                          Last reviewed: {new Date(breakdown.knowledgeSharing.lastReviewed).toLocaleDateString()}
                        </div>
                      ) : (
                        <div className="text-yellow-600 pl-2">
                          {isAdmin ? 'Not yet reviewed' : 'Pending review'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tool Usage Breakdown */}
                  <div>
                    <div className="font-medium text-gray-700 mb-2">Tool Usage ({toolScore}/50 points)</div>
                    <div className="text-xs text-gray-600">
                      Score based on security tool implementation across 4 categories:
                      <ul className="list-disc list-inside mt-1 space-y-1 text-gray-500">
                        <li>SAST (Static Application Security Testing)</li>
                        <li>DAST (Dynamic Application Security Testing)</li>
                        <li>Application Firewall (WAF)</li>
                        <li>API Security</li>
                      </ul>
                      <div className="mt-2 text-gray-500">
                        Each tool is scored based on integration level, tool quality, and application risk factors.
                      </div>
                    </div>
                  </div>

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

