import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card.jsx';
import { Input } from '../ui/Input.jsx';
import { Select } from '../ui/Select.jsx';
import { Textarea } from '../ui/Textarea.jsx';

export function ProductMetadataCard({
  isEditing,
  canEdit,
  handleFieldClick,
  formData,
  handleFieldChange,
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Product Metadata</CardTitle>
          {!isEditing && canEdit && (
            <span className="text-xs text-gray-500">Click any field to edit</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative">
        {canEdit && !isEditing && (
          <div
            onClick={handleFieldClick}
            className="absolute inset-0 z-10 cursor-pointer"
            style={{ backgroundColor: 'transparent' }}
          />
        )}
        {isEditing ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Name"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                required
              />
              <Input
                label="Owner"
                value={formData.owner}
                onChange={(e) => handleFieldChange('owner', e.target.value)}
              />
              <Select
                label="Facing"
                value={formData.facing}
                onChange={(e) => handleFieldChange('facing', e.target.value)}
                options={[
                  { value: 'Internal', label: 'Internal' },
                  { value: 'External', label: 'External' },
                  { value: 'Both', label: 'Both' },
                ]}
                placeholder="Select facing"
              />
              <Select
                label="Status"
                value={formData.status}
                onChange={(e) => handleFieldChange('status', e.target.value)}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'planned', label: 'Planned' },
                  { value: 'retired', label: 'Retired' },
                ]}
              />
              <Input
                label="Lifecycle Stage"
                value={formData.lifecycleStage}
                onChange={(e) => handleFieldChange('lifecycleStage', e.target.value)}
              />
              <Input
                label="Business Criticality (1-5)"
                type="number"
                min="1"
                max="5"
                value={formData.businessCriticality}
                onChange={(e) => handleFieldChange('businessCriticality', e.target.value)}
              />
              <Input
                label="Data Sensitivity"
                value={formData.dataSensitivity}
                onChange={(e) => handleFieldChange('dataSensitivity', e.target.value)}
              />
            </div>
            <div className="mt-4">
              <Textarea
                label="Description"
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                rows={3}
              />
            </div>
            <div className="mt-4">
              <Textarea
                label="Compliance Notes"
                value={formData.complianceNotes}
                onChange={(e) => handleFieldChange('complianceNotes', e.target.value)}
                rows={3}
              />
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                <p className="text-base text-gray-900 font-medium">
                  {formData.name || <span className="text-gray-400 italic">Not set</span>}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Owner</label>
                <p className="text-sm text-gray-900">
                  {formData.owner || <span className="text-gray-400 italic">Not set</span>}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Facing</label>
                <p className="text-sm text-gray-900">
                  {formData.facing || <span className="text-gray-400 italic">Not set</span>}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                <p className="text-sm text-gray-900">
                  {formData.status || <span className="text-gray-400 italic">Not set</span>}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Lifecycle Stage</label>
                <p className="text-sm text-gray-900">
                  {formData.lifecycleStage || <span className="text-gray-400 italic">Not set</span>}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Business Criticality
                </label>
                <p className="text-sm text-gray-900">
                  {formData.businessCriticality ? (
                    `${formData.businessCriticality}/5`
                  ) : (
                    <span className="text-gray-400 italic">Not set</span>
                  )}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Data Sensitivity
                </label>
                <p className="text-sm text-gray-900">
                  {formData.dataSensitivity || <span className="text-gray-400 italic">Not set</span>}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
              <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                {formData.description || <span className="text-gray-400 italic">Not set</span>}
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Compliance Notes</label>
              <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                {formData.complianceNotes || <span className="text-gray-400 italic">Not set</span>}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
