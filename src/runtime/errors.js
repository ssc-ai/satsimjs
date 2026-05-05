/**
 * Create an Error that carries an HTTP-compatible status code.
 *
 * @param {string} message Error message.
 * @param {number} [statusCode=400] HTTP status code to expose.
 * @returns {Error} Runtime error.
 */
export function createRuntimeError(message, statusCode = 400) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

/**
 * Convert a millisecond timestamp to an ISO string.
 *
 * @param {number} value Millisecond timestamp.
 * @returns {string|null} ISO timestamp or null for invalid values.
 */
export function toIsoTime(value) {
  return Number.isFinite(value) ? new Date(value).toISOString() : null
}
