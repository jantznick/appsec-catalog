/**
 * Calculate the completeness percentage of an application
 * @param {Object} application - The application object
 * @returns {Object} - { filled, total, percentage }
 */
export function calculateCompleteness(application) {
  // List of all fields that should be filled for a complete application
  const fields = [
    // Basic info
    'name',           // Required, always filled
    'description',
    'owner',
    'repoUrl',
    
    // Application details
    'language',
    'framework',
    'serverEnvironment',
    'facing',
    'deploymentType',
    'authProfiles',
    'dataTypes',
    
    // Security tools
    'sastTool',
    'sastIntegrationLevel',
    'dastTool',
    'dastIntegrationLevel',
    'appFirewallTool',
    'appFirewallIntegrationLevel',
    'apiSecurityTool',
    'apiSecurityIntegrationLevel',
    'apiSecurityNA',
    
    // Interfaces (count as 1 field if present)
    'interfaces',
  ];
  
  let filled = 0;
  const total = fields.length;
  
  fields.forEach(field => {
    const value = application[field];
    
    if (field === 'interfaces') {
      // Interfaces is a JSON string, count as filled if it exists and is not empty
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            filled++;
          }
        } catch {
          // If it's not valid JSON, don't count it
        }
      }
    } else if (field === 'apiSecurityNA') {
      // Boolean field - count as filled if explicitly set (true or false)
      if (value !== null && value !== undefined) {
        filled++;
      }
    } else if (field === 'sastIntegrationLevel' || 
               field === 'dastIntegrationLevel' || 
               field === 'appFirewallIntegrationLevel' || 
               field === 'apiSecurityIntegrationLevel') {
      // Integration levels are numbers, count if not null/undefined
      if (value !== null && value !== undefined) {
        filled++;
      }
    } else {
      // String fields - count if not null, undefined, or empty string
      if (value !== null && value !== undefined && value !== '') {
        filled++;
      }
    }
  });
  
  const percentage = Math.round((filled / total) * 100);
  
  return {
    filled,
    total,
    percentage,
  };
}




