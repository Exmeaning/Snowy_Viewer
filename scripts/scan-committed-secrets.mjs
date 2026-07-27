#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const git = (...args) => execFileSync('git', args, { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 })
const gitText = (...args) => git(...args).toString('utf8').trim()

const findings = []
const seen = new Set()
const blobCache = new Map()

function addFinding(rule, scope, path, data, offset = 0) {
  const line = data.includes(0) ? null : data.subarray(0, offset).reduce((count, byte) => count + (byte === 10 ? 1 : 0), 1)
  const key = `${rule}\0${scope}\0${path}\0${line ?? offset}`
  if (seen.has(key)) return
  seen.add(key)
  findings.push({ rule, scope, path, line, offset: line === null ? offset : undefined })
}

function isAllowedSyntheticTestPath(path) {
  return /(?:^|\/)(?:testdata|tests?|fixtures?|examples?|mocks?)(?:\/|$)/i.test(path) ||
    /(?:^|\/)[^/]+_(?:test|tests)\.[^/]+$/i.test(path) ||
    /(?:^|\/).*\.(?:test|spec)\.[^/]+$/i.test(path)
}

function isAllowedExamplePath(path) {
  return isAllowedSyntheticTestPath(path) || /(?:^|\/)\.env\.(?:example|sample|template)$/i.test(path)
}

function isHistoricalPlaceholderCredential(scope, username, password) {
  return scope === 'candidate-history-only' && isPlaceholder(username) && isPlaceholder(password)
}

function isPlaceholder(value) {
  const normalized = value.toLowerCase()
  return value === '' ||
    normalized === 'dev' || normalized === 'secret' ||
    /(?:example|dummy|fake|fixture|synthetic|test-only|testonly|not-a-real|not_real|change-?me|replace|placeholder|local-admin-password|your[_-]|<[^>]+>|\.\.\.|\$\{|\$\(|secrets\.|vars\.)/i.test(value)
}

function entropy(value) {
  if (!value.length) return 0
  const counts = new Map()
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1)
  let result = 0
  for (const count of counts.values()) {
    const probability = count / value.length
    result -= probability * Math.log2(probability)
  }
  return result
}

const exactSecretPatterns = [
  ['private-key', new RegExp('-----BEGIN ' + '(?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----', 'g')],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{40,255})\b/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['slack-token', /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g],
  ['stripe-live-key', /\b(?:sk|rk)_live_[0-9A-Za-z]{16,}\b/g],
  ['openai-style-key', /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ['npm-token', /\bnpm_[A-Za-z0-9]{30,}\b/g],
  ['sendgrid-key', /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g],
]

const homePatterns = [
  new RegExp('/' + 'Users/([^/\\s"\'\\x00]+)/', 'g'),
  new RegExp('/' + 'home/([^/\\s"\'\\x00]+)/', 'g'),
  new RegExp('[A-Z]:\\\\' + 'Users\\\\([^\\\\\\s"\'\\x00]+)\\\\', 'gi'),
]
const allowedHomeUsers = new Set(['[user]', '<user>', 'user', 'username', 'example', 'example-user', 'test', 'test-user', 'runner', 'runneradmin', 'root', 'node', 'app'])

function scanPath(path, scope, data) {
  const lower = path.toLowerCase()
  const base = lower.split('/').at(-1)
  const allowedEnv = /^\.env\.(?:example|sample|template)$/.test(base)
  if ((base === '.env' || base.startsWith('.env.')) && !allowedEnv) addFinding('environment-file', scope, path, data)
  if (/^(?:\.npmrc|\.pypirc|\.netrc|kubeconfig|credentials|secrets?)$/i.test(base)) addFinding('credential-file', scope, path, data)
  if (/^(?:id_rsa|id_ed25519|id_dsa|id_ecdsa)$/i.test(base) || /\.(?:pem|key|p12|pfx|jks|keystore|mobileprovision)$/i.test(base)) {
    addFinding('private-key-file', scope, path, data)
  }
  if (/(?:^|\/)(?:\.claude|\.grok|\.cursor|\.idea|\.fleet)(?:\/|$)/i.test(path) ||
      (/(?:^|\/)\.vscode\//i.test(path) && !/(?:^|\/)\.vscode\/extensions\.json$/i.test(path)) ||
      /(?:^|\/).*\.code-workspace$/i.test(path)) {
    addFinding('personal-tool-config', scope, path, data)
  }
  if (/(?:^|\/)local-dist(?:\/|$)/i.test(path) || /(?:^|\/)docker-compose\.override\.ya?ml$/i.test(path)) {
    addFinding('local-build-or-override', scope, path, data)
  }
  if (/(?:^|\/)(?:node_modules|coverage|target|\.next)(?:\/|$)/i.test(path)) addFinding('generated-or-dependency-tree', scope, path, data)
  if (/\.(?:db|sqlite|sqlite3)(?:-[^/]*)?$/i.test(path) && !isAllowedExamplePath(path)) addFinding('runtime-database', scope, path, data)
  if (/^web\/public\/data\/mysekai-preview\/[^/]+\.json$/i.test(path)) {
    try {
      const snapshot = JSON.parse(data.toString('utf8').replace(/^\uFEFF/, ''))
      const visit = (value) => {
        if (Array.isArray(value)) return value.forEach(visit)
        if (!value || typeof value !== 'object') return
        for (const [key, nested] of Object.entries(value)) {
          if (/^(?:userName|displayName|nickname)$/i.test(key) && nested !== 'preview-user') {
            addFinding('non-synthetic-public-user-identity', scope, path, data)
          }
          visit(nested)
        }
      }
      visit(snapshot)
    } catch {
      addFinding('invalid-public-preview-json', scope, path, data)
    }
  }
}

function scanContent(path, scope, data) {
  const text = data.toString('latin1')
  for (const [rule, pattern] of exactSecretPatterns) {
    pattern.lastIndex = 0
    for (let match = pattern.exec(text); match; match = pattern.exec(text)) addFinding(rule, scope, path, data, match.index)
  }

  if (!isAllowedSyntheticTestPath(path)) {
    const authenticatedURL = /https?:\/\/([^\s/@:]+):([^\s/@]+)@[^\s/]+/g
    for (let match = authenticatedURL.exec(text); match; match = authenticatedURL.exec(text)) {
      if (!isHistoricalPlaceholderCredential(scope, match[1], match[2])) {
        addFinding('url-embedded-credential', scope, path, data, match.index)
      }
    }
  }

  if (!isAllowedExamplePath(path)) {
    const jwt = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{10,}\b/g
    for (let match = jwt.exec(text); match; match = jwt.exec(text)) addFinding('jwt-literal', scope, path, data, match.index)

    const assignment = /\b([A-Z][A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|ACCESS_KEY|REFRESH_TOKEN)[A-Z0-9_]*)\s*=\s*([^\s#]+)/g
    for (let match = assignment.exec(text); match; match = assignment.exec(text)) {
      const value = match[2].replace(/^["']|["',;]+$/g, '')
      const context = text.slice(Math.max(0, match.index - 32), match.index)
      const comparedOrReferenced = /(?:process\.env\.|required\(|if\s*\(|&&|\|\||===?|!==?|\$\{)\s*$/.test(context) || value.startsWith('process.env.')
      if (!comparedOrReferenced && !isPlaceholder(value) && value.length >= 12 && (value.length >= 24 || entropy(value) >= 3.4)) {
        addFinding('literal-credential-assignment', scope, path, data, match.index)
      }
    }
  }

  for (const pattern of homePatterns) {
    pattern.lastIndex = 0
    for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
      const user = match[1].toLowerCase()
      const suffix = text.slice(match.index + match[0].length, match.index + match[0].length + 96)
      const regexSource = /\[swd]|\x[0-9a-f]{2}|\u[0-9a-f]{4}|\+|\*|\?|\)|\]|\}/i.test(suffix)
      if (!allowedHomeUsers.has(user) && !user.startsWith('[^') && !user.startsWith('(?') && !regexSource) {
        addFinding('absolute-home-path', scope, path, data, match.index)
      }
    }
  }
}

function readBlob(oid) {
  if (!blobCache.has(oid)) blobCache.set(oid, git('cat-file', 'blob', oid))
  return blobCache.get(oid)
}

function currentTree() {
  if (process.env.SECRET_SCAN_INCLUDE_INDEX === '1') {
    return gitText('write-tree')
  }
  return 'HEAD'
}

function headEntries(tree) {
  const raw = git('ls-tree', '-r', '-z', tree)
  const entries = []
  for (const record of raw.toString('binary').split('\0')) {
    if (!record) continue
    const tab = record.indexOf('\t')
    const metadata = record.slice(0, tab).split(' ')
    if (metadata[1] === 'blob') entries.push({ oid: metadata[2], path: Buffer.from(record.slice(tab + 1), 'binary').toString('utf8') })
  }
  return entries
}

function rangeEntries(base) {
  if (!/^[0-9a-f]{40}$/i.test(base) || /^0+$/.test(base)) return []
  if (spawnSync('git', ['cat-file', '-e', `${base}^{commit}`]).status !== 0) return []
  const objects = gitText('rev-list', '--objects', `${base}..${tree}`)
  if (!objects) return []
  const checked = execFileSync('git', ['cat-file', '--batch-check=%(objecttype) %(objectname) %(rest)'], {
    input: objects + '\n', encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  })
  const result = []
  for (const line of checked.split('\n')) {
    if (!line.startsWith('blob ')) continue
    const [, oid, ...pathParts] = line.split(' ')
    result.push({ oid, path: pathParts.join(' ') || '<deleted-or-renamed-blob>' })
  }
  return result
}

const tree = currentTree()
const current = headEntries(tree)
const currentOids = new Set(current.map((entry) => entry.oid))
for (const entry of current) {
  const data = readBlob(entry.oid)
  scanPath(entry.path, 'head-tree', data)
  scanContent(entry.path, 'head-tree', data)
}

const base = process.env.SECRET_SCAN_BASE_SHA ?? ''
for (const entry of rangeEntries(base)) {
  if (currentOids.has(entry.oid)) continue
  const data = readBlob(entry.oid)
  scanPath(entry.path, 'candidate-history-only', data)
  scanContent(entry.path, 'candidate-history-only', data)
}

if (base && /^[0-9a-f]{40}$/i.test(base) && !/^0+$/.test(base)) {
  const metadata = git('log', '--format=%H%n%an%n%ae%n%B%x00', `${base}..HEAD`)
  scanContent('<candidate-commit-metadata>', 'candidate-commit-metadata', metadata)
}

if (findings.length) {
  findings.sort((a, b) => `${a.scope}\0${a.path}\0${a.line ?? a.offset}\0${a.rule}`.localeCompare(`${b.scope}\0${b.path}\0${b.line ?? b.offset}\0${b.rule}`))
  for (const finding of findings) {
    const location = finding.line == null ? `${finding.path}@byte-${finding.offset}` : `${finding.path}:${finding.line}`
    console.error(`SECRET_SCAN ${finding.rule} ${finding.scope} ${location}`)
  }
  console.error(`Committed-secret scan failed with ${findings.length} finding(s). Matched values are intentionally not printed.`)
  process.exit(1)
}

const digest = createHash('sha256').update(current.map(({ oid, path }) => `${oid} ${path}\n`).join('')).digest('hex')
console.log(`Committed-secret scan passed: ${current.length} tracked files, tree inventory sha256 ${digest}.`)
