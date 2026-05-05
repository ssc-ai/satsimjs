import { createRuntimeError, toIsoTime } from './errors.js'

const WRITE_POLICIES = new Set(['multi', 'single', 'readOnly'])
const CAPABILITIES = new Set(['read', 'write'])

function createSessionId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  const randomPart = Math.random().toString(36).slice(2)
  return `session-${Date.now().toString(36)}-${randomPart}`
}

function normalizeWritePolicy(value) {
  const normalized = String(value ?? 'multi').trim()
  if (!WRITE_POLICIES.has(normalized)) {
    throw createRuntimeError(`Invalid write policy: ${value}`)
  }
  return normalized
}

function normalizeCapability(value) {
  const normalized = String(value ?? 'read').trim().toLowerCase()
  if (!CAPABILITIES.has(normalized)) {
    throw createRuntimeError(`Invalid session capability: ${value}`)
  }
  return normalized
}

function sanitizeHolderLabel(value) {
  return String(value || 'Client').trim() || 'Client'
}

/**
 * Tracks runtime client sessions and enforces the runner write policy.
 *
 * Supported policies are:
 * - `multi`: multiple write sessions are allowed.
 * - `single`: only one write session may be active at a time.
 * - `readOnly`: write sessions are rejected.
 */
export class SessionManager {
  /**
   * Create a session manager.
   *
   * @param {object} [options]
   * @param {'multi'|'single'|'readOnly'} [options.writePolicy='multi'] Policy used for write-capable sessions.
   * @param {number} [options.leaseMs=30000] Session lease duration in milliseconds.
   * @param {() => number} [options.now=Date.now] Clock used for deterministic tests and lease expiry.
   */
  constructor({ writePolicy = 'multi', leaseMs = 30000, now = () => Date.now() } = {}) {
    this.writePolicy = normalizeWritePolicy(writePolicy)
    this.leaseMs = Math.max(1000, Number(leaseMs) || 30000)
    this.now = now
    this._sessions = new Map()
  }

  /**
   * Replace the active write policy. Switching to `readOnly` drops any existing write sessions.
   *
   * @param {'multi'|'single'|'readOnly'} writePolicy New write policy.
   */
  setWritePolicy(writePolicy) {
    this.writePolicy = normalizeWritePolicy(writePolicy)
    if (this.writePolicy === 'readOnly') {
      for (const [sessionId, session] of this._sessions.entries()) {
        if (session.capability === 'write') {
          this._sessions.delete(sessionId)
        }
      }
    }
  }

  /**
   * Create a read or write runtime session.
   *
   * @param {object} [request]
   * @param {string} [request.holderLabel='Client'] Human-readable client/operator label.
   * @param {'read'|'write'} [request.capability='read'] Requested session capability.
   * @returns {object} Public session descriptor.
   */
  createSession({ holderLabel = 'Client', capability = 'read' } = {}) {
    this._purgeExpired()
    const normalizedCapability = normalizeCapability(capability)

    if (normalizedCapability === 'write' && this.writePolicy === 'readOnly') {
      throw createRuntimeError('Runtime is configured read-only.', 403)
    }

    if (normalizedCapability === 'write' && this.writePolicy === 'single' && this._activeWriteSession()) {
      throw createRuntimeError('A write session is already active.', 409)
    }

    const nowMs = this.now()
    const session = {
      sessionId: createSessionId(),
      holderLabel: sanitizeHolderLabel(holderLabel),
      capability: normalizedCapability,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + this.leaseMs
    }
    this._sessions.set(session.sessionId, session)
    return this._publicSession(session)
  }

  /**
   * Renew a session lease and return the public session descriptor.
   *
   * @param {string} sessionId Session to renew.
   * @returns {object} Public session descriptor.
   */
  heartbeat(sessionId) {
    const session = this.requireSession(sessionId)
    session.expiresAtMs = this.now() + this.leaseMs
    return this._publicSession(session)
  }

  /**
   * Renew a session lease and return the internal session record for runtime attribution.
   *
   * @param {string} sessionId Session to renew.
   * @returns {object} Internal session record.
   */
  touch(sessionId) {
    const session = this.requireSession(sessionId)
    session.expiresAtMs = this.now() + this.leaseMs
    return session
  }

  /**
   * Release a session lease.
   *
   * @param {string} sessionId Session to release.
   * @returns {{released: boolean}} Release result.
   */
  release(sessionId) {
    const session = this.requireSession(sessionId)
    this._sessions.delete(session.sessionId)
    return { released: true }
  }

  /**
   * Resolve a non-expired session or throw a runtime error.
   *
   * @param {string} sessionId Session to resolve.
   * @returns {object} Internal session record.
   */
  requireSession(sessionId) {
    this._purgeExpired()
    const normalized = String(sessionId || '').trim()
    const session = normalized ? this._sessions.get(normalized) : null
    if (!session) {
      throw createRuntimeError('Unknown or expired session.', 409)
    }
    return session
  }

  /**
   * Resolve a write-capable session or throw a runtime error.
   *
   * @param {string} sessionId Session to resolve.
   * @returns {object} Internal session record.
   */
  requireWriteSession(sessionId) {
    const session = this.requireSession(sessionId)
    if (session.capability !== 'write') {
      throw createRuntimeError('Session does not have write capability.', 403)
    }
    if (this.writePolicy === 'readOnly') {
      throw createRuntimeError('Runtime is configured read-only.', 403)
    }
    return session
  }

  /**
   * Remove all active sessions.
   */
  clear() {
    this._sessions.clear()
  }

  /**
   * Serialize current session state for runtime snapshots.
   *
   * @returns {object} Snapshot containing policy, counts, and public session descriptors.
   */
  snapshot() {
    this._purgeExpired()
    const sessions = [...this._sessions.values()].map((session) => this._publicSession(session))
    return {
      writePolicy: this.writePolicy,
      readCount: sessions.filter((session) => session.capability === 'read').length,
      writeCount: sessions.filter((session) => session.capability === 'write').length,
      sessions
    }
  }

  _activeWriteSession() {
    this._purgeExpired()
    return [...this._sessions.values()].find((session) => session.capability === 'write') ?? null
  }

  _purgeExpired() {
    const nowMs = this.now()
    for (const [sessionId, session] of this._sessions.entries()) {
      if (session.expiresAtMs <= nowMs) {
        this._sessions.delete(sessionId)
      }
    }
  }

  _publicSession(session) {
    return {
      sessionId: session.sessionId,
      holderLabel: session.holderLabel,
      capability: session.capability,
      createdAtIso: toIsoTime(session.createdAtMs),
      expiresAtIso: toIsoTime(session.expiresAtMs)
    }
  }
}

export default SessionManager
