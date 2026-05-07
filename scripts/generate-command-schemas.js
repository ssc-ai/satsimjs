import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCommandSchemaArtifacts } from '../src/engine/command/schemas.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const outputDir = path.resolve(__dirname, '../schemas/command/v1')

function writeJson(relativePath, schema) {
  const target = path.join(outputDir, relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${JSON.stringify(schema, null, 2)}\n`)
}

fs.rmSync(outputDir, { recursive: true, force: true })
for (const [relativePath, schema] of buildCommandSchemaArtifacts()) {
  writeJson(relativePath, schema)
}
