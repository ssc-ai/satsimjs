import SessionManager from '../src/runtime/SessionManager.js'

describe('SessionManager', () => {
  test('grants multiple write sessions in multi-writer mode', () => {
    const manager = new SessionManager({ writePolicy: 'multi' })
    const first = manager.createSession({ holderLabel: 'A', capability: 'write' })
    const second = manager.createSession({ holderLabel: 'B', capability: 'write' })

    expect(first.sessionId).toBeTruthy()
    expect(second.sessionId).toBeTruthy()
    expect(first.sessionId).not.toBe(second.sessionId)
    expect(manager.snapshot().writeCount).toBe(2)
  })

  test('rejects a second write session in single-writer mode', () => {
    const manager = new SessionManager({ writePolicy: 'single' })
    manager.createSession({ holderLabel: 'A', capability: 'write' })

    expect(() => manager.createSession({ holderLabel: 'B', capability: 'write' })).toThrow(/write session/)
    expect(manager.createSession({ holderLabel: 'Reader', capability: 'read' }).capability).toBe('read')
  })

  test('rejects write sessions in read-only mode', () => {
    const manager = new SessionManager({ writePolicy: 'readOnly' })

    expect(manager.createSession({ holderLabel: 'Reader', capability: 'read' }).capability).toBe('read')
    expect(() => manager.createSession({ holderLabel: 'Writer', capability: 'write' })).toThrow(/read-only/)
  })

  test('expires sessions and allows a new single writer after expiry', () => {
    let nowMs = Date.parse('2026-04-03T16:00:00Z')
    const manager = new SessionManager({
      writePolicy: 'single',
      leaseMs: 5000,
      now: () => nowMs
    })

    const first = manager.createSession({ holderLabel: 'A', capability: 'write' })
    nowMs += 4000
    manager.heartbeat(first.sessionId)
    nowMs += 4000
    expect(manager.snapshot().writeCount).toBe(1)

    nowMs += 2000
    expect(manager.snapshot().writeCount).toBe(0)
    expect(manager.createSession({ holderLabel: 'B', capability: 'write' }).holderLabel).toBe('B')
  })
})
