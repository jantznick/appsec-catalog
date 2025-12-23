/**
 * Check if clipboard API is available (requires HTTPS or localhost)
 */
export const isClipboardAvailable = () => {
  return typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext;
};

/**
 * Copy text to clipboard with error handling
 * @param {string} text - Text to copy
 * @param {Function} onSuccess - Success callback (optional)
 * @param {Function} onError - Error callback (optional)
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export const copyToClipboard = async (text, onSuccess, onError) => {
  if (!isClipboardAvailable()) {
    const error = 'Copy to clipboard is only available over HTTPS';
    if (onError) onError(error);
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    if (onSuccess) onSuccess();
    return true;
  } catch (error) {
    if (onError) onError(error.message || 'Failed to copy to clipboard');
    return false;
  }
};




