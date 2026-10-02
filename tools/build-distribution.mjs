#!/usr/bin/env node
// Usage: CF_API_KEY=... node tools/build-distribution.mjs [--out dist-site] [--base-url URL] [--resolved file.json]
// --resolved skips the network and reads a pre-resolved list (used by tests and offline runs).
import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDistribution, overrideModules, reportBlocked } from './lib/distro.mjs'
import { resolveAll } from './lib/resolve.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d }

const out = resolve(arg('out', join(root, 'site')))
const baseUrl = arg('base-url', 'https://redgiii.github.io/moroland-launcher')
const manifest = JSON.parse(readFileSync(join(root, 'pack/manifest.json'), 'utf8'))
const server = JSON.parse(readFileSync(join(root, 'pack/server.json'), 'utf8'))

let resolved
if (arg('resolved')) {
    resolved = JSON.parse(readFileSync(resolve(arg('resolved')), 'utf8'))
} else {
    const key = process.env.CF_API_KEY
    if (!key) { console.error('CF_API_KEY is missing (or pass --resolved).'); process.exit(1) }
    resolved = await resolveAll(manifest.files, key)
}

const overridesDir = join(root, 'pack/overrides')
const distro = buildDistribution({
    server,
    resolved,
    overrides: overrideModules(overridesDir, baseUrl),
    version: new Date().toISOString().slice(0, 10).replaceAll('-', '.')
})
const blocked = reportBlocked(resolved)

mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'distribution.json'), JSON.stringify(distro, null, 2))
writeFileSync(join(out, 'blocked.json'), JSON.stringify(blocked, null, 2))
cpSync(overridesDir, join(out, 'overrides'), { recursive: true })
copyFileSync(join(root, 'pack/server.json'), join(out, 'server.json'))

const bySource = resolved.reduce((a, r) => { const k = r.blocked ? 'blocked' : r.source; a[k] = (a[k] ?? 0) + 1; return a }, {})
console.log(`Mods: ${resolved.length}`, bySource)
if (blocked.length) console.log('Blocked (manual download):\n' + blocked.map(b => ` - ${b.name ?? b.projectID}: ${b.reason}`).join('\n'))
