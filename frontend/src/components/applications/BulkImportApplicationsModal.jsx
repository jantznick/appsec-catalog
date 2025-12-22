import { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Select } from '../ui/Select.jsx';
import { toast } from '../ui/Toast.jsx';
import { api } from '../../lib/api.js';

// Application fields that can be imported
const APPLICATION_FIELDS = [
  { key: 'name', label: 'Application Name', required: true, dataType: 'string' },
  { key: 'description', label: 'Description', required: false, dataType: 'string' },
  { key: 'owner', label: 'Owner', required: false, dataType: 'string' },
  { key: 'repoUrl', label: 'Repository URL', required: false, dataType: 'string' },
  { key: 'language', label: 'Language', required: false, dataType: 'string' },
  { key: 'framework', label: 'Framework', required: false, dataType: 'string' },
  { key: 'serverEnvironment', label: 'Server Environment', required: false, dataType: 'string' },
  { key: 'facing', label: 'Facing (Internal/External)', required: false, dataType: 'string' },
  { key: 'deploymentType', label: 'Deployment Type', required: false, dataType: 'string' },
  { key: 'authProfiles', label: 'Auth Profiles', required: false, dataType: 'string' },
  { key: 'dataTypes', label: 'Data Types', required: false, dataType: 'string' },
  { key: 'devTeamContact', label: 'Dev Team Contact', required: false, dataType: 'string' },
  { key: 'businessCriticality', label: 'Business Criticality (1-5)', required: false, dataType: 'number' },
  { key: 'criticalAspects', label: 'Critical Aspects', required: false, dataType: 'string' },
  { key: 'securityTestingDescription', label: 'Security Testing Description', required: false, dataType: 'string' },
  { key: 'additionalNotes', label: 'Additional Notes', required: false, dataType: 'string' },
  { key: 'sastTool', label: 'SAST Tool', required: false, dataType: 'string' },
  { key: 'sastIntegrationLevel', label: 'SAST Integration Level', required: false, dataType: 'number' },
  { key: 'dastTool', label: 'DAST Tool', required: false, dataType: 'string' },
  { key: 'dastIntegrationLevel', label: 'DAST Integration Level', required: false, dataType: 'number' },
  { key: 'appFirewallTool', label: 'App Firewall Tool', required: false, dataType: 'string' },
  { key: 'appFirewallIntegrationLevel', label: 'App Firewall Integration Level', required: false, dataType: 'number' },
  { key: 'apiSecurityTool', label: 'API Security Tool', required: false, dataType: 'string' },
  { key: 'apiSecurityIntegrationLevel', label: 'API Security Integration Level', required: false, dataType: 'number' },
  { key: 'apiSecurityNA', label: 'API Security N/A', required: false, dataType: 'boolean' },
];

// Infer data type from CSV column values
const inferCSVDataType = (header, csvData) => {
  if (!csvData || csvData.length === 0) return 'unknown';
  
  const values = csvData
    .map(row => row[header])
    .filter(v => v !== null && v !== undefined && v !== '')
    .slice(0, 10); // Sample first 10 non-empty values
  
  if (values.length === 0) return 'unknown';
  
  // Check for boolean
  const booleanValues = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'];
  if (values.every(v => booleanValues.includes(v.toLowerCase().trim()))) {
    return 'boolean';
  }
  
  // Check for number
  if (values.every(v => !isNaN(v) && !isNaN(parseFloat(v)) && isFinite(v))) {
    return 'number';
  }
  
  // Check for URL
  if (values.some(v => /^https?:\/\//.test(v.trim()))) {
    return 'url';
  }
  
  // Check for email
  if (values.some(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))) {
    return 'email';
  }
  
  // Default to string
  return 'string';
};

const getDataTypeLabel = (dataType) => {
  const labels = {
    string: 'String',
    number: 'Number',
    boolean: 'Boolean',
    url: 'URL',
    email: 'Email',
    unknown: 'Unknown',
  };
  return labels[dataType] || dataType;
};

export function BulkImportApplicationsModal({ isOpen, onClose, companies, onSuccess }) {
  const [step, setStep] = useState(1); // 1: Upload, 2: Map fields, 3: Review
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({}); // Maps CSV header -> application field key
  const [csvDataTypes, setCsvDataTypes] = useState({}); // Maps CSV header -> inferred data type
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setCsvFile(file);
    parseCSV(file);
  };

  const parseCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        toast.error('CSV file is empty');
        return;
      }

      // Simple CSV parser that handles quoted values
      const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];
          
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              // Escaped quote
              current += '"';
              i++; // Skip next quote
            } else {
              // Toggle quote state
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        
        // Add last field
        result.push(current.trim());
        return result;
      };

      // Parse headers
      const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
      setCsvHeaders(headers);

      // Parse data rows
      const data = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''));
        if (values.some(v => v)) { // Only add non-empty rows
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          data.push(row);
        }
      }

      setCsvData(data);
      
      // Infer data types for each CSV column
      const inferredTypes = {};
      headers.forEach(header => {
        inferredTypes[header] = inferCSVDataType(header, data);
      });
      setCsvDataTypes(inferredTypes);
      
      // Auto-map common field names (reverse mapping: CSV header -> field key)
      const autoMapping = {};
      headers.forEach(header => {
        const lowerHeader = header.toLowerCase();
        APPLICATION_FIELDS.forEach(field => {
          if (field.key === 'name' && (lowerHeader.includes('name') || lowerHeader.includes('app'))) {
            autoMapping[header] = field.key;
          } else if (lowerHeader.includes(field.key.toLowerCase()) || lowerHeader === field.label.toLowerCase()) {
            if (!autoMapping[header]) {
              autoMapping[header] = field.key;
            }
          }
        });
      });
      setFieldMapping(autoMapping);

      if (data.length > 0) {
        setStep(2);
      } else {
        toast.error('No data rows found in CSV');
      }
    };
    reader.readAsText(file);
  };

  const handleMappingChange = (csvHeader, fieldKey) => {
    setFieldMapping(prev => ({
      ...prev,
      [csvHeader]: fieldKey || '',
    }));
  };

  const validateMapping = () => {
    const requiredFields = APPLICATION_FIELDS.filter(f => f.required);
    const mappedFields = Object.values(fieldMapping).filter(v => v);
    
    for (const field of requiredFields) {
      if (!mappedFields.includes(field.key)) {
        toast.error(`Please map the required field: ${field.label}`);
        return false;
      }
    }
    return true;
  };

  const handleImport = async () => {
    if (!selectedCompanyId) {
      toast.error('Please select a company');
      return;
    }

    if (!validateMapping()) {
      return;
    }

    setImporting(true);
    try {
      // Transform CSV data to application format
      const applications = csvData.map(row => {
        const app = {};
        // Iterate through CSV headers and map to application fields
        Object.entries(fieldMapping).forEach(([csvHeader, fieldKey]) => {
          if (fieldKey && row[csvHeader]) {
            const value = row[csvHeader].trim();
            if (value) {
              const field = APPLICATION_FIELDS.find(f => f.key === fieldKey);
              if (field) {
                // Handle data type conversion
                if (field.dataType === 'number') {
                  const num = parseFloat(value);
                  if (!isNaN(num)) {
                    app[fieldKey] = num;
                  }
                } else if (field.dataType === 'boolean') {
                  const lowerValue = value.toLowerCase().trim();
                  app[fieldKey] = lowerValue === 'true' || lowerValue === 'yes' || lowerValue === '1' || lowerValue === 'y';
                } else {
                  app[fieldKey] = value;
                }
              }
            }
          }
        });
        return app;
      });

      // Call bulk import API
      const result = await api.bulkImportApplications(selectedCompanyId, applications);
      
      toast.success(`Successfully imported ${result.count} application(s)`);
      onSuccess?.();
      handleClose();
    } catch (error) {
      toast.error(error.message || 'Failed to import applications');
      console.error('Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedCompanyId('');
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setFieldMapping({});
    setCsvDataTypes({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Import Applications">
      <div className="space-y-6">
        {step === 1 && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Company
              </label>
              <Select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                options={[
                  { value: '', label: 'Select a company...' },
                  ...companies.map(c => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload CSV File
              </label>
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <a
                  href="/demo-applications-import.csv"
                  download="demo-applications-import.csv"
                  className="text-sm text-blue-600 hover:text-blue-700 underline"
                >
                  Download Demo CSV
                </a>
              </div>
              <p className="text-xs text-gray-500">
                CSV file should contain application data with headers in the first row. 
                <a
                  href="/demo-applications-import.csv"
                  download="demo-applications-import.csv"
                  className="text-blue-600 hover:text-blue-700 underline ml-1"
                >
                  Download a sample CSV
                </a>
                {' '}to see the expected format.
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Found {csvData.length} application(s)</strong> in the CSV file.
                Please map the CSV columns to application fields below.
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-4">
              {csvHeaders.map(header => {
                const mappedFieldKey = fieldMapping[header] || '';
                const mappedField = APPLICATION_FIELDS.find(f => f.key === mappedFieldKey);
                const csvDataType = csvDataTypes[header] || 'unknown';
                const sampleValue = csvData.length > 0 && csvData[0][header] 
                  ? (csvData[0][header].length > 50 ? csvData[0][header].substring(0, 50) + '...' : csvData[0][header])
                  : '(empty)';
                
                return (
                  <div key={header} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          {header}
                        </label>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>
                            CSV Type: <span className="font-medium text-gray-700">{getDataTypeLabel(csvDataType)}</span>
                          </span>
                          {mappedField && (
                            <>
                              <span>→</span>
                              <span>
                                Field Type: <span className="font-medium text-gray-700">{getDataTypeLabel(mappedField.dataType)}</span>
                              </span>
                              {mappedField.required && (
                                <span className="text-red-500 font-medium">(Required)</span>
                              )}
                            </>
                          )}
                        </div>
                        {sampleValue !== '(empty)' && (
                          <p className="text-xs text-gray-400 mt-1 italic">
                            Sample: {sampleValue}
                          </p>
                        )}
                      </div>
                    </div>
                    <Select
                      value={mappedFieldKey}
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                      options={[
                        { value: '', label: '-- Skip this column --' },
                        ...APPLICATION_FIELDS.map(field => ({ 
                          value: field.key, 
                          label: `${field.label} (${getDataTypeLabel(field.dataType)})${field.required ? ' *' : ''}` 
                        })),
                      ]}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? 'Importing...' : `Import ${csvData.length} Application(s)`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

