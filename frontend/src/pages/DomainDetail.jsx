import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage, LoadingSpinner } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Tabs, Tab, TabPanel } from '../components/ui/Tabs.jsx';
import useAuthStore from '../store/authStore.js';

function getStatusBadgeClasses(status) {
  const normalized = (status || 'unknown').toLowerCase();
  if (normalized === 'active') return 'bg-green-100 text-green-800';
  if (normalized === 'parked') return 'bg-yellow-100 text-yellow-800';
  if (normalized === 'deprecated') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

function getRecordCount(serializedRecords) {
  if (!serializedRecords) return 0;
  try {
    const parsed = JSON.parse(serializedRecords);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function getSingleRecordCount(value) {
  return value ? 1 : 0;
}

function getDkimRecordCount(serializedRecords) {
  const parsed = parseSerializedValue(serializedRecords, {});
  if (!parsed || typeof parsed !== 'object') return 0;
  return Object.values(parsed).reduce((count, records) => {
    if (!Array.isArray(records)) return count;
    return count + records.length;
  }, 0);
}

function parseSerializedRecords(serializedRecords) {
  if (!serializedRecords) return [];
  try {
    const parsed = JSON.parse(serializedRecords);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseSerializedValue(serializedValue, fallbackValue = null) {
  if (!serializedValue) return fallbackValue;
  try {
    return JSON.parse(serializedValue);
  } catch {
    return fallbackValue;
  }
}

function parseChangeDetails(details) {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function formatChangeValue(value) {
  if (value === null || value === undefined) return '(none)';
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty)';
    if (value.length <= 4) return value.join(', ');
    return `${value.slice(0, 4).join(', ')} +${value.length - 4} more`;
  }
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json.length > 120 ? `${json.slice(0, 117)}...` : json;
    } catch {
      return '(object)';
    }
  }
  const stringified = String(value);
  return stringified.length > 120 ? `${stringified.slice(0, 117)}...` : stringified;
}

const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'SPF', 'DMARC', 'DKIM'];

function getDnsRecordValues(recordType, snapshot, parsed) {
  if (!snapshot) return [];

  switch (recordType) {
    case 'A':
      return parsed.a;
    case 'AAAA':
      return parsed.aaaa;
    case 'CNAME':
      return parsed.cname;
    case 'TXT':
      return parsed.txt;
    case 'MX':
      return parsed.mx.map((record) => `${record.exchange || 'unknown'} (priority ${record.priority ?? 0})`);
    case 'NS':
      return parsed.ns;
    case 'SPF':
      return snapshot.spfRecord ? [snapshot.spfRecord] : [];
    case 'DMARC':
      return snapshot.dmarcRecord ? [snapshot.dmarcRecord] : [];
    case 'DKIM': {
      const entries = Object.entries(parsed.dkim || {});
      if (entries.length === 0) return [];
      return entries.flatMap(([selector, records]) => {
        if (!Array.isArray(records) || records.length === 0) {
          return [`${selector}: no record`];
        }
        return records.map((record) => `${selector}: ${record}`);
      });
    }
    default:
      return [];
  }
}

export function DomainDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const [domain, setDomain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [dnsSnapshots, setDnsSnapshots] = useState([]);
  const [dnsChanges, setDnsChanges] = useState([]);
  const [loadingDns, setLoadingDns] = useState(false);
  const [runningDnsCheck, setRunningDnsCheck] = useState(false);
  const [webSnapshots, setWebSnapshots] = useState([]);
  const [loadingWebSnapshots, setLoadingWebSnapshots] = useState(false);
  const [runningWebSnapshot, setRunningWebSnapshot] = useState(false);
  const [selectedWebSnapshot, setSelectedWebSnapshot] = useState(null);
  const [selectedDnsSnapshotId, setSelectedDnsSnapshotId] = useState(null);
  const [selectedDnsRecordType, setSelectedDnsRecordType] = useState('A');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    owner: '',
    status: 'unknown',
  });

  const loadDomain = async () => {
    try {
      setLoading(true);
      const data = await api.getDomain(id);
      setDomain(data);
      const nextFormData = {
        name: data.name || '',
        description: data.description || '',
        owner: data.owner || '',
        status: data.status || 'unknown',
      };
      setFormData(nextFormData);
      setOriginalFormData(nextFormData);
      setHasUnsavedChanges(false);
    } catch (error) {
      toast.error('Failed to load domain');
      console.error(error);
      navigate('/domains');
    } finally {
      setLoading(false);
    }
  };

  const updateFormField = (field, value) => {
    const nextFormData = { ...formData, [field]: value };
    setFormData(nextFormData);

    if (originalFormData) {
      setHasUnsavedChanges(JSON.stringify(nextFormData) !== JSON.stringify(originalFormData));
    }
  };

  const startEditing = () => {
    setIsEditing(true);
    if (originalFormData) {
      setHasUnsavedChanges(JSON.stringify(formData) !== JSON.stringify(originalFormData));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.updateDomain(id, {
        name: formData.name,
        description: formData.description,
        owner: formData.owner,
        status: formData.status,
      });
      toast.success('Domain metadata updated');
      setOriginalFormData(formData);
      setHasUnsavedChanges(false);
      setIsEditing(false);
      await loadDomain();
    } catch (error) {
      toast.error(error.message || 'Failed to update domain metadata');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    if (originalFormData) {
      setFormData(originalFormData);
    }
    setHasUnsavedChanges(false);
    setShowCancelModal(false);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      setShowCancelModal(true);
      return;
    }
    cancelEditing();
  };

  const loadDnsData = async () => {
    try {
      setLoadingDns(true);
      const [snapshots, changes] = await Promise.all([
        api.getDomainDnsSnapshots(id),
        api.getDomainDnsChanges(id),
      ]);
      const normalizedSnapshots = Array.isArray(snapshots) ? snapshots : [];
      setDnsSnapshots(normalizedSnapshots);
      setDnsChanges(Array.isArray(changes) ? changes : []);
      setSelectedDnsSnapshotId((previousId) => {
        if (previousId && normalizedSnapshots.some((snapshot) => snapshot.id === previousId)) {
          return previousId;
        }
        return null;
      });
    } catch (error) {
      console.error('Failed to load DNS data:', error);
      setDnsSnapshots([]);
      setDnsChanges([]);
      setSelectedDnsSnapshotId(null);
    } finally {
      setLoadingDns(false);
    }
  };

  const loadWebSnapshots = async () => {
    try {
      setLoadingWebSnapshots(true);
      const snapshots = await api.getDomainWebSnapshots(id);
      setWebSnapshots(Array.isArray(snapshots) ? snapshots : []);
    } catch (error) {
      console.error('Failed to load web snapshots:', error);
      setWebSnapshots([]);
    } finally {
      setLoadingWebSnapshots(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadDomain();
      loadDnsData();
      loadWebSnapshots();
    }
  }, [id]);

  const handleRunDnsCheck = async () => {
    try {
      setRunningDnsCheck(true);
      const result = await api.runDomainDnsCheck(id);
      const changeCount = result?.changesDetected || 0;
      toast.success(changeCount > 0 ? `DNS check complete (${changeCount} change${changeCount !== 1 ? 's' : ''} detected)` : 'DNS check complete');
      await loadDnsData();
    } catch (error) {
      toast.error(error.message || 'Failed to run DNS check');
      console.error(error);
    } finally {
      setRunningDnsCheck(false);
    }
  };

  const handleRunWebSnapshot = async () => {
    try {
      setRunningWebSnapshot(true);
      const snapshot = await api.runDomainWebSnapshot(id);
      if (snapshot?.error) {
        toast.error(`Snapshot failed: ${snapshot.error}`);
      } else {
        toast.success(snapshot?.usedHttpFallback ? 'Web snapshot complete (HTTP fallback used)' : 'Web snapshot complete');
      }
      await loadWebSnapshots();
    } catch (error) {
      toast.error(error.message || 'Failed to run web snapshot');
      console.error(error);
    } finally {
      setRunningWebSnapshot(false);
    }
  };

  const latestSnapshot = dnsSnapshots[0] || null;
  const selectedDnsSnapshot = dnsSnapshots.find((snapshot) => snapshot.id === selectedDnsSnapshotId) || null;

  if (loading) {
    return <LoadingPage message="Loading domain..." />;
  }

  if (!domain) {
    return null;
  }

  const relatedDomains = domain.relatedDomains || [];
  const relationships = domain.relationships || {};
  const apexDomainRecord = relatedDomains.find(
    (relatedDomain) => relatedDomain.name === domain.apexDomain
  );
  const dnsChangesBySnapshotId = dnsChanges.reduce((acc, change) => {
    if (!acc[change.snapshotId]) {
      acc[change.snapshotId] = [];
    }
    acc[change.snapshotId].push(change);
    return acc;
  }, {});

  return (
    <div className={isEditing ? 'pb-24' : ''}>
      <div className="mb-8">
        <button
          onClick={() => navigate('/domains')}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Back to Domains
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{domain.name}</h1>
            {domain.company?.id ? (
              <p className="text-gray-600">
                Company:{' '}
                <Link to={`/companies/${domain.company.id}`} className="text-blue-600 hover:text-blue-700">
                  {domain.company.name}
                </Link>
              </p>
            ) : (
              <p className="text-gray-600">Company: —</p>
            )}
          </div>
          {isAdmin() && (
            <Button
              variant={isEditing ? 'secondary' : 'outline'}
              onClick={() => (isEditing ? handleCancelEdit() : startEditing())}
            >
              {isEditing ? 'Cancel' : 'Edit Metadata'}
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Domain Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div
              onClick={!isEditing && isAdmin() ? startEditing : undefined}
              className="p-2 text-left"
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Domain Name</p>
              {isEditing ? (
                <input
                  value={formData.name}
                  onChange={(e) => updateFormField('name', e.target.value)}
                  placeholder="example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <p className="text-gray-900">{domain.name || '—'}</p>
              )}
            </div>

            <div
              onClick={!isEditing && isAdmin() ? startEditing : undefined}
              className="p-2 text-left"
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Owner</p>
              {isEditing ? (
                <input
                  value={formData.owner}
                  onChange={(e) => updateFormField('owner', e.target.value)}
                  placeholder="Team contacts, email aliases, or owner notes"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <p className="text-gray-900">{domain.owner || '—'}</p>
              )}
            </div>

            <div
              onClick={!isEditing && isAdmin() ? startEditing : undefined}
              className="p-2 text-left"
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Status</p>
              {isEditing ? (
                <select
                  value={formData.status}
                  onChange={(e) => updateFormField('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="unknown">unknown</option>
                  <option value="active">active</option>
                  <option value="parked">parked</option>
                  <option value="deprecated">deprecated</option>
                </select>
              ) : (
                <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeClasses(domain.status)}`}>
                  {domain.status || 'unknown'}
                </span>
              )}
            </div>

            <div
              onClick={!isEditing && apexDomainRecord?.id ? () => navigate(`/domains/${apexDomainRecord.id}`) : undefined}
              className={!isEditing && apexDomainRecord?.id ? 'p-2 text-left cursor-pointer' : 'p-2 text-left'}
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Apex Domain Group</p>
              <p className={apexDomainRecord?.id ? 'text-blue-600' : 'text-gray-900'}>
                {domain.apexDomain || '—'}
              </p>
            </div>

            <div className="p-2 text-left">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Updated</p>
              <p className="text-gray-900">
                {domain.updatedAt ? new Date(domain.updatedAt).toLocaleString() : '—'}
              </p>
            </div>

            <div
              onClick={!isEditing && isAdmin() ? startEditing : undefined}
              className="md:col-span-2 p-2 text-left"
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Description</p>
              {isEditing ? (
                <textarea
                  value={formData.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  placeholder="Add optional context for this domain"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                />
              ) : (
                <p className="text-gray-900 whitespace-pre-wrap">{domain.description || 'No description provided'}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs className="mb-6" defaultTab={0}>
        <Tab>Related Domains</Tab>
        <Tab>DNS Info</Tab>
        <Tab>Web Snapshots</Tab>
        <Tab>Applications</Tab>

        <TabPanel>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Related Domains ({relatedDomains.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  {relationships.isApexDomain ? (
                    <>
                      <p className="font-medium text-gray-900 mb-1">This is the apex domain.</p>
                      <p>
                        {relationships.children?.length > 0
                          ? `Detected ${relationships.children.length} related subdomain${relationships.children.length !== 1 ? 's' : ''}.`
                          : 'No related subdomains detected yet.'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-gray-900 mb-1">Parent apex domain</p>
                      {relationships.parent ? (
                        <Link to={`/domains/${relationships.parent.id}`} className="text-blue-600 hover:text-blue-700">
                          {relationships.parent.name}
                        </Link>
                      ) : (
                        <p>No apex domain record exists yet for this group.</p>
                      )}
                    </>
                  )}
                </div>

                {relatedDomains.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applications</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {relatedDomains.map((relatedDomain) => (
                          <tr key={relatedDomain.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {relatedDomain.id === domain.id ? (
                                <span className="font-semibold text-blue-700">{relatedDomain.name}</span>
                              ) : (
                                <Link to={`/domains/${relatedDomain.id}`} className="text-blue-600 hover:text-blue-700">
                                  {relatedDomain.name}
                                </Link>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {relatedDomain._count?.applicationDomains || 0}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{relatedDomain.owner || '—'}</td>
                            <td className="px-4 py-2 text-sm">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeClasses(relatedDomain.status)}`}>
                                {relatedDomain.status || 'unknown'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel>
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>DNS Checks</CardTitle>
                {isAdmin() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunDnsCheck}
                    loading={runningDnsCheck}
                  >
                    Run DNS Check
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingDns ? (
                <div className="py-4">
                  <LoadingSpinner size="md" />
                  <p className="text-sm text-gray-500 text-center mt-2">Loading DNS history...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {latestSnapshot ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-medium text-gray-900">
                        Latest check: {new Date(latestSnapshot.checkedAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        Status: <span className="font-medium">{latestSnapshot.status}</span>
                        {latestSnapshot.error ? ` • ${latestSnapshot.error}` : ''}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No DNS checks run yet.</p>
                  )}

                  {dnsSnapshots.length > 0 && (
                    <div className="space-y-2">
                      {dnsSnapshots.slice(0, 10).map((snapshot) => {
                        const isOpen = selectedDnsSnapshot?.id === snapshot.id;
                        const snapshotChanges = dnsChangesBySnapshotId[snapshot.id] || [];
                        const changedRecordTypes = [...new Set(snapshotChanges.map((change) => change.recordType))];
                        const changeCountByRecordType = snapshotChanges.reduce((acc, change) => {
                          acc[change.recordType] = (acc[change.recordType] || 0) + 1;
                          return acc;
                        }, {});
                        const parsedSnapshotRecords = {
                          a: parseSerializedRecords(snapshot.aRecords),
                          aaaa: parseSerializedRecords(snapshot.aaaaRecords),
                          cname: parseSerializedRecords(snapshot.cnameRecords),
                          txt: parseSerializedRecords(snapshot.txtRecords),
                          mx: parseSerializedRecords(snapshot.mxRecords),
                          ns: parseSerializedRecords(snapshot.nsRecords),
                          dkim: parseSerializedValue(snapshot.dkimRecords, {}),
                        };
                        const snapshotRecordValues = getDnsRecordValues(
                          selectedDnsRecordType,
                          snapshot,
                          parsedSnapshotRecords
                        );
                        const selectedTypeChanges = snapshotChanges
                          .filter((change) => change.recordType === selectedDnsRecordType)
                          .map((change) => ({
                            ...change,
                            parsedDetails: parseChangeDetails(change.details),
                          }));

                        return (
                          <div
                            key={snapshot.id}
                            onClick={() => {
                              setSelectedDnsSnapshotId((currentId) => (
                                currentId === snapshot.id ? null : snapshot.id
                              ));
                            }}
                            className={`p-3 rounded border cursor-pointer transition-all ${
                              isOpen
                                ? 'border-blue-500 bg-blue-50'
                                : snapshotChanges.length > 0
                                ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50/60'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-xs text-gray-500">
                                    {isOpen ? '▼' : '▶'}
                                  </span>
                                  <span className="text-sm font-medium text-gray-900">
                                    {new Date(snapshot.checkedAt).toLocaleString()}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                    snapshot.status === 'ok'
                                      ? 'bg-green-100 text-green-800'
                                      : snapshot.status === 'warning'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {snapshot.status}
                                  </span>
                                  {snapshotChanges.length > 0 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                                      {snapshotChanges.length} change{snapshotChanges.length !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  <span className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">A {getRecordCount(snapshot.aRecords)}</span>
                                  <span className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">AAAA {getRecordCount(snapshot.aaaaRecords)}</span>
                                  <span className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">CNAME {getRecordCount(snapshot.cnameRecords)}</span>
                                  <span className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">TXT {getRecordCount(snapshot.txtRecords)}</span>
                                  <span className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">MX {getRecordCount(snapshot.mxRecords)}</span>
                                  <span className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">NS {getRecordCount(snapshot.nsRecords)}</span>
                                  <span className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">SPF {getSingleRecordCount(snapshot.spfRecord)}</span>
                                  <span className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">DMARC {getSingleRecordCount(snapshot.dmarcRecord)}</span>
                                  <span className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">DKIM {getDkimRecordCount(snapshot.dkimRecords)}</span>
                                </div>
                                {snapshotChanges.length > 0 && (
                                  <p className="text-xs text-amber-800 mt-2">
                                    Changed: {changedRecordTypes.join(', ')}
                                  </p>
                                )}
                              </div>
                            </div>

                            {isOpen && (
                              <div className="mt-3 pt-3 border-t border-gray-200 space-y-3" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-gray-700">Record Details</h4>
                                  <span className="text-xs text-gray-500">Select record type to inspect</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {DNS_RECORD_TYPES.map((recordType) => (
                                    <button
                                      key={recordType}
                                      type="button"
                                      onClick={() => setSelectedDnsRecordType(recordType)}
                                      className={`px-2.5 py-1 rounded text-xs font-medium border ${
                                        selectedDnsRecordType === recordType
                                          ? 'bg-blue-600 text-white border-blue-600'
                                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                      }`}
                                    >
                                      {recordType}
                                      {changeCountByRecordType[recordType] > 0 && (
                                        <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                          selectedDnsRecordType === recordType
                                            ? 'bg-blue-200 text-blue-900'
                                            : 'bg-amber-100 text-amber-800'
                                        }`}>
                                          {changeCountByRecordType[recordType]}
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                                <div className="p-2">
                                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                    {selectedDnsRecordType} Records
                                  </p>
                                  {selectedTypeChanges.length > 0 && (
                                    <div className="mb-3 space-y-2">
                                      {selectedTypeChanges.map((change) => (
                                        <div key={`delta-${change.id}`} className="p-2 rounded">
                                          <p className="text-xs font-semibold text-gray-700 mb-1">{change.summary}</p>
                                          {change.parsedDetails ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                              <div>
                                                <div className="text-[11px] text-gray-500 mb-1">Current</div>
                                                <div className="text-xs text-gray-700 bg-green-50 p-1.5 rounded break-words font-mono">
                                                  {formatChangeValue(change.parsedDetails.current)}
                                                </div>
                                              </div>
                                              <div>
                                                <div className="text-[11px] text-gray-500 mb-1">Previous</div>
                                                <div className="text-xs text-gray-700 bg-red-50 p-1.5 rounded break-words font-mono">
                                                  {formatChangeValue(change.parsedDetails.previous)}
                                                </div>
                                              </div>
                                            </div>
                                          ) : (
                                            <p className="text-xs text-gray-500">Detailed diff not available for this change.</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {snapshotRecordValues.length > 0 && selectedTypeChanges.length === 0 ? (
                                    <div className="space-y-1 max-h-56 overflow-auto pr-1">
                                      {snapshotRecordValues.map((value, index) => (
                                        <p
                                          key={`${selectedDnsRecordType}-${snapshot.id}-${index}`}
                                          className="text-sm text-gray-900 font-mono break-all"
                                        >
                                          {value}
                                        </p>
                                      ))}
                                    </div>
                                  ) : selectedTypeChanges.length === 0 ? (
                                    <p className="text-sm text-gray-500">No records found for this type in this snapshot.</p>
                                  ) : null}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel>
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Web Snapshots</CardTitle>
                {isAdmin() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunWebSnapshot}
                    loading={runningWebSnapshot}
                  >
                    Run Web Snapshot
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingWebSnapshots ? (
                <div className="py-4">
                  <LoadingSpinner size="md" />
                  <p className="text-sm text-gray-500 text-center mt-2">Loading web snapshot history...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {webSnapshots.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Snapshot History</h4>
                      <div className="space-y-3">
                        {webSnapshots.map((snapshot) => (
                          <div
                            key={snapshot.id}
                            onClick={() => setSelectedWebSnapshot(snapshot)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedWebSnapshot(snapshot);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            className="flex items-start justify-between gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-900">
                                  {new Date(snapshot.checkedAt).toLocaleString()}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  snapshot.error ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {snapshot.error ? 'failed' : 'captured'}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                                  {snapshot.usedHttpFallback ? 'http fallback' : 'https'}
                                </span>
                                {snapshot.statusCode && (
                                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                                    {snapshot.statusCode}
                                  </span>
                                )}
                                {snapshot.loadTimeMs && (
                                  <span className="text-xs text-gray-500">{snapshot.loadTimeMs}ms</span>
                                )}
                              </div>
                              {snapshot.title && (
                                <p className="text-sm text-gray-700 mt-1 truncate">Title: {snapshot.title}</p>
                              )}
                              <p className="text-sm text-gray-600 mt-1 truncate">
                                {snapshot.finalUrl || 'No final URL captured'}
                              </p>
                              {snapshot.error && (
                                <p className="text-sm text-red-700 mt-1 truncate">{snapshot.error}</p>
                              )}
                            </div>
                            <div className="w-[150px] h-[150px] rounded border border-gray-200 bg-white overflow-hidden flex-shrink-0">
                              {snapshot.screenshotUrl ? (
                                <img
                                  src={snapshot.screenshotUrl}
                                  alt={`Snapshot preview for ${domain.name}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 p-2 text-center">
                                  No image
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No web snapshots run yet.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel>
          <Card>
            <CardHeader>
              <CardTitle>Associated Applications ({domain.applications?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent padding="none">
              {domain.applications && domain.applications.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application Name</TableHead>
                      <TableHead>Owner</TableHead>
                      {isAdmin() && <TableHead>Company</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domain.applications.map((application) => (
                      <TableRow key={application.id}>
                        <TableCell>
                          <Link
                            to={`/applications/${application.id}`}
                            className="font-medium text-blue-600 hover:text-blue-700"
                          >
                            {application.name}
                          </Link>
                        </TableCell>
                        <TableCell>{application.owner || '—'}</TableCell>
                        {isAdmin() && (
                          <TableCell>
                            {application.company ? (
                              <Link
                                to={`/companies/${application.company.id}`}
                                className="text-gray-700 hover:text-blue-600"
                              >
                                {application.company.name}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            application.status === 'onboarded'
                              ? 'bg-green-100 text-green-800'
                              : application.status === 'pending_technical'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {application.status || 'onboarded'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/applications/${application.id}`}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            View →
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  No applications hosted on this domain
                </div>
              )}
            </CardContent>
          </Card>
        </TabPanel>
      </Tabs>

      {isEditing && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {hasUnsavedChanges ? (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>You have unsaved changes</span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No changes made</div>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={saving}
                  disabled={!hasUnsavedChanges}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!selectedWebSnapshot}
        onClose={() => setSelectedWebSnapshot(null)}
        title="Web Snapshot Details"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedWebSnapshot(null)}>
              Close
            </Button>
            {selectedWebSnapshot?.finalUrl && (
              <a
                href={selectedWebSnapshot.finalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              >
                Open Site
              </a>
            )}
            {selectedWebSnapshot?.screenshotUrl && (
              <a
                href={selectedWebSnapshot.screenshotUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                Open Image
              </a>
            )}
          </>
        }
      >
        {selectedWebSnapshot && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <p><span className="font-medium text-gray-700">Checked:</span> {new Date(selectedWebSnapshot.checkedAt).toLocaleString()}</p>
              <p><span className="font-medium text-gray-700">Status:</span> {selectedWebSnapshot.error ? 'failed' : 'captured'}</p>
              <p><span className="font-medium text-gray-700">Attempted:</span> {selectedWebSnapshot.urlAttempted}</p>
              <p><span className="font-medium text-gray-700">Protocol:</span> {selectedWebSnapshot.usedHttpFallback ? 'http fallback' : 'https'}</p>
              <p><span className="font-medium text-gray-700">HTTP Status:</span> {selectedWebSnapshot.statusCode || '—'}</p>
              <p><span className="font-medium text-gray-700">Load Time:</span> {selectedWebSnapshot.loadTimeMs ? `${selectedWebSnapshot.loadTimeMs}ms` : '—'}</p>
            </div>

            {selectedWebSnapshot.title && (
              <p className="text-sm text-gray-700">
                <span className="font-medium">Title:</span> {selectedWebSnapshot.title}
              </p>
            )}

            {selectedWebSnapshot.finalUrl && (
              <p className="text-sm text-gray-700 break-all">
                <span className="font-medium">Final URL:</span> {selectedWebSnapshot.finalUrl}
              </p>
            )}

            {selectedWebSnapshot.error && (
              <div className="rounded border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{selectedWebSnapshot.error}</p>
              </div>
            )}

            {selectedWebSnapshot.screenshotUrl ? (
              <img
                src={selectedWebSnapshot.screenshotUrl}
                alt={`Snapshot for ${domain.name}`}
                className="w-full max-h-[520px] object-contain rounded border border-gray-200 bg-white"
              />
            ) : (
              <p className="text-sm text-gray-500">No screenshot captured for this run.</p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Discard Changes?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
              Keep Editing
            </Button>
            <Button
              variant="primary"
              onClick={cancelEditing}
              className="bg-red-600 hover:bg-red-700"
            >
              Discard Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            You have unsaved changes. Are you sure you want to discard them?
          </p>
          <p className="text-sm text-red-600">
            This action cannot be undone. All your changes will be lost.
          </p>
        </div>
      </Modal>
    </div>
  );
}

