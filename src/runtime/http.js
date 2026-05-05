function writeSse(res, payload) {
  res.write('event: state\n')
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

/**
 * Send a no-store JSON response.
 *
 * @param {object} res Node HTTP response.
 * @param {number} statusCode HTTP status code.
 * @param {object} payload JSON payload.
 */
export function sendJson(res, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(body.length),
    'Cache-Control': 'no-store'
  })
  res.end(body)
}

/**
 * Read and parse a JSON request body with a byte limit.
 *
 * @param {object} req Node HTTP request.
 * @param {number} [maxBytes=65536] Maximum accepted request body size.
 * @returns {Promise<object>} Parsed JSON payload.
 */
export async function parseJsonBody(req, maxBytes = 64 * 1024) {
  const chunks = []
  let totalBytes = 0

  for await (const chunk of req) {
    totalBytes += chunk.length
    if (totalBytes > maxBytes) {
      const err = new Error('Request body too large')
      err.statusCode = 413
      throw err
    }
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(raw || '{}')
  } catch (_) {
    const err = new Error('Malformed JSON')
    err.statusCode = 400
    throw err
  }
}

/**
 * Create a small state-only SSE broadcast channel.
 *
 * @returns {object} Channel with `attach`, `broadcast`, and `closeAll`.
 */
export function createSseChannel() {
  const clients = new Set()

  return {
    broadcast(payload) {
      for (const client of clients) {
        writeSse(client, payload)
      }
    },
    attach(req, res, initialPayload) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive'
      })
      res.write('retry: 1000\n\n')
      writeSse(res, initialPayload)
      clients.add(res)
      req.on('close', () => {
        clients.delete(res)
      })
    },
    closeAll() {
      for (const client of clients) {
        client.end()
      }
      clients.clear()
    }
  }
}
