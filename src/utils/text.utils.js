/**
 * Utility functions for text cleaning and string sanitization.
 */

/**
 * Clean and normalize arbitrary text input.
 * Strips non-printable characters, unifies whitespace, and trims edges.
 * @param {string} text - The input string to sanitize.
 * @returns {string} Cleaned string.
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '') // remove ASCII control characters
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ') // collapse horizontal spaces
    .replace(/\n\s*\n+/g, '\n') // collapse multiple blank lines
    .trim();
}

/**
 * Checks if a string has meaningful textual content.
 * @param {string} text
 * @returns {boolean}
 */
function hasMeaningfulText(text) {
  if (typeof text !== 'string') return false;
  const cleaned = sanitizeText(text);
  // Must have at least 3 characters and at least one word character
  return cleaned.length >= 3 && /[a-zA-Z0-9]/.test(cleaned);
}

module.exports = {
  sanitizeText,
  hasMeaningfulText
};
