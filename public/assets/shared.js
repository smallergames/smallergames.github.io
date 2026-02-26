/**
 * Shared Utilities
 *
 * Common functions used across multiple modules.
 */

// Cached DOM reference
let announcements = null;
let announceTimeout = null;

/**
 * Initialize shared utilities (must be called once from app.js)
 */
export function initShared() {
  announcements = document.getElementById('announcements');
}

/**
 * Announce a message to screen readers via the announcements element.
 * Clears after 1 second. Subsequent calls cancel previous announcements.
 * @param {string} message - The message to announce
 */
export function announce(message) {
  if (!announcements) return;
  if (announceTimeout) {
    clearTimeout(announceTimeout);
  }
  announcements.textContent = message;
  announceTimeout = setTimeout(() => {
    announcements.textContent = '';
    announceTimeout = null;
  }, 1000);
}
