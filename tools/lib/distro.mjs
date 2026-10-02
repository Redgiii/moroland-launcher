// Pure functions that turn a resolved modpack into a Helios distribution index.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const MOD_GROUP = 'moroland.mods'

export function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'mod'
}

// Maven-style id required by Helios for ForgeMod modules.
export function modId(slug, fileId) {
    return `${MOD_GROUP}:${slugify(slug)}:${fileId}`
}

// Helios needs the artifact path, otherwise it builds "<artifact>-<version>.jar" from the id.
export function modModule(r) {
    return {
        id: modId(r.slug ?? `p${r.projectID}`, r.fileID),
        name: r.name ?? r.slug ?? r.fileName,
        type: 'ForgeMod',
        artifact: {
            size: r.size,
            MD5: r.md5,
            url: r.url,
            path: `${slugify(r.slug ?? `p${r.projectID}`)}/${r.fileID}/${r.fileName}`
        }
    }
}

export function fileModule(relPath, buf, baseUrl) {
    const posix = relPath.split(sep).join('/')
    const isMod = posix.startsWith('mods/')
    return {
        id: isMod ? modId(posix.replace(/\.jar$/, '').split('/').pop(), 'local') : `moroland:override:${posix}`,
        name: posix,
        type: isMod ? 'ForgeMod' : 'File',
        artifact: {
            size: buf.length,
            MD5: createHash('md5').update(buf).digest('hex'),
            url: `${baseUrl}/overrides/${posix.split('/').map(encodeURIComponent).join('/')}`,
            path: isMod ? `local/${posix.split('/').pop()}` : posix
        }
    }
}

export function walk(dir) {
    const out = []
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) out.push(...walk(p))
        else if (statSync(p).isFile()) out.push(p)
    }
    return out.sort()
}

export function overrideModules(overridesDir, baseUrl, include = ['config', 'mods']) {
    const files = []
    for (const sub of include) {
        try { files.push(...walk(join(overridesDir, sub))) } catch { /* optional folder */ }
    }
    return files.map(f => fileModule(relative(overridesDir, f), readFileSync(f), baseUrl))
}

export function buildDistribution({ server, resolved, overrides, version = '1.0.0' }) {
    const { loader, ...rest } = server
    const loaderModule = {
        id: loader.id,
        name: loader.name,
        type: 'ForgeHosted',
        artifact: { size: 0, url: loader.url }
    }
    const mods = resolved.filter(r => !r.blocked).map(modModule)
    return {
        version,
        rss: 'https://github.com/Redgiii/moroland-launcher/releases.atom',
        servers: [{ ...rest, modules: [loaderModule, ...mods, ...overrides] }]
    }
}

export function reportBlocked(resolved) {
    return resolved.filter(r => r.blocked).map(r => ({
        projectID: r.projectID, fileID: r.fileID, name: r.name ?? r.slug, reason: r.reason
    }))
}
