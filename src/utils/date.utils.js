const { format } = require('date-fns');
const { toZonedTime, format: formatInTz } = require('date-fns-tz');

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns current Date in the specified timezone.
 * @param {string} timeZone
 * @returns {Date}
 */
function getCurrentZonedTime(timeZone = DEFAULT_TIMEZONE) {
  const now = new Date();
  return toZonedTime(now, timeZone);
}

/**
 * Formats a Date object to YYYY-MM-DD in the target timezone.
 * @param {Date} date
 * @param {string} timeZone
 * @returns {string} e.g. "2026-10-09"
 */
function formatDateToISO(date, timeZone = DEFAULT_TIMEZONE) {
  return formatInTz(date, 'yyyy-MM-dd', { timeZone });
}

/**
 * Formats time from Date object to 24-hour HH:mm in the target timezone.
 * @param {Date} date
 * @param {string} timeZone
 * @returns {string} e.g. "15:00"
 */
function formatTimeTo24H(date, timeZone = DEFAULT_TIMEZONE) {
  return formatInTz(date, 'HH:mm', { timeZone });
}

module.exports = {
  DEFAULT_TIMEZONE,
  getCurrentZonedTime,
  formatDateToISO,
  formatTimeTo24H
};
