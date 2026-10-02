// Resolves CurseForge (projectID, fileID) pairs to a downloadable URL on an official CDN.
// Order: Modrinth CDN (matched by sha1) > CurseForge CDN (only if the author allows it) > blocked.
// Nothing is downloaded: only metadata and hashes are read.

const CF = 'https://api.curseforge.com'
const MR = 'https://api.modrinth.com/v2'
const UA = 'Redgiii/moroland-launcher (metadata resolver)'

const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

async function postJson(url, body, headers = {}) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': UA, ...headers },
        body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
    return res.json()
}

export async function fetchCurseForge(entries, apiKey) {
    const h = { 'x-api-key': apiKey }
    const files = new Map()
    const mods = new Map()
    for (const c of chunk(entries, 50)) {
        const f = await postJson(`${CF}/v1/mods/files`, { fileIds: c.map(e => e.fileID) }, h)
        for (const x of f.data) files.set(x.id, x)
        const m = await postJson(`${CF}/v1/mods`, { modIds: [...new Set(c.map(e => e.projectID))] }, h)
        for (const x of m.data) mods.set(x.id, x)
    }
    return { files, mods }
}

export async function fetchModrinth(sha1s) {
    const out = {}
    for (const c of chunk(sha1s, 200)) {
        Object.assign(out, await postJson(`${MR}/version_files`, { hashes: c, algorithm: 'sha1' }))
    }
    return out
}

const hashOf = (file, algo) => file.hashes?.find(h => h.algo === algo)?.value

export function pickResolution(entry, cfFile, cfMod, mrVersion) {
    const base = { projectID: entry.projectID, fileID: entry.fileID }
    if (!cfFile) return { ...base, blocked: true, reason: 'file not found on CurseForge' }
    const sha1 = hashOf(cfFile, 1)
    const md5 = hashOf(cfFile, 2)
    const info = {
        ...base,
        slug: cfMod?.slug,
        name: cfMod?.name,
        fileName: cfFile.fileName,
        size: cfFile.fileLength,
        md5,
        sha1
    }
    if (!md5) return { ...info, blocked: true, reason: 'no md5 published by CurseForge' }
    const mrFile = mrVersion?.files?.find(f => f.hashes?.sha1 === sha1)
    if (mrFile?.url) return { ...info, url: mrFile.url, source: 'modrinth' }
    if (cfMod?.allowModDistribution !== false && cfFile.downloadUrl) {
        return { ...info, url: cfFile.downloadUrl, source: 'curseforge' }
    }
    return { ...info, blocked: true, reason: 'author disables third-party distribution (download manually)' }
}

export async function resolveAll(entries, apiKey) {
    const { files, mods } = await fetchCurseForge(entries, apiKey)
    const sha1s = entries.map(e => hashOf(files.get(e.fileID) ?? {}, 1)).filter(Boolean)
    const mr = await fetchModrinth(sha1s)
    return entries.map(e => {
        const f = files.get(e.fileID)
        return pickResolution(e, f, mods.get(e.projectID), f ? mr[hashOf(f, 1)] : undefined)
    })
}
