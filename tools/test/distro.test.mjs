import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDistribution, modId, overrideModules, reportBlocked, slugify } from '../lib/distro.mjs'
import { pickResolution } from '../lib/resolve.mjs'

const cfFile = { id: 7, fileName: 'a-1.0.jar', fileLength: 10, downloadUrl: 'https://edge.forgecdn.net/a.jar',
    hashes: [{ value: 'sha', algo: 1 }, { value: 'md5v', algo: 2 }] }

test('slugify and modId give a valid maven id', () => {
    assert.equal(slugify('Foo Bar!'), 'foo-bar')
    assert.equal(modId('Foo Bar', 7), 'moroland.mods:foo-bar:7')
})

test('Modrinth CDN is preferred when the sha1 matches', () => {
    const r = pickResolution({ projectID: 1, fileID: 7 }, cfFile, { slug: 'a', allowModDistribution: true },
        { files: [{ hashes: { sha1: 'sha' }, url: 'https://cdn.modrinth.com/a.jar' }] })
    assert.equal(r.source, 'modrinth')
    assert.equal(r.md5, 'md5v')
})

test('CurseForge URL is used only when distribution is allowed', () => {
    assert.equal(pickResolution({ projectID: 1, fileID: 7 }, cfFile, { slug: 'a', allowModDistribution: true }).source, 'curseforge')
    const blocked = pickResolution({ projectID: 1, fileID: 7 }, cfFile, { slug: 'a', allowModDistribution: false })
    assert.equal(blocked.blocked, true)
})

test('a null downloadUrl is blocked, never guessed', () => {
    const r = pickResolution({ projectID: 1, fileID: 7 }, { ...cfFile, downloadUrl: null }, { slug: 'a' })
    assert.equal(r.blocked, true)
})

test('distribution has loader, mods and overrides; blocked mods are left out', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ov-'))
    mkdirSync(join(dir, 'config'))
    writeFileSync(join(dir, 'config', 'x.toml'), 'a=1')
    const resolved = [
        { projectID: 1, fileID: 7, slug: 'a', fileName: 'a-1.0.jar', size: 10, md5: 'm', url: 'https://cdn/a.jar' },
        { projectID: 2, fileID: 8, slug: 'b', blocked: true, reason: 'x' }
    ]
    const d = buildDistribution({
        server: { id: 's', name: 'S', loader: { id: 'net.minecraftforge:forge:1.20.1-47.4.10', name: 'F', url: 'https://f' } },
        resolved, overrides: overrideModules(dir, 'https://site')
    })
    const types = d.servers[0].modules.map(m => m.type)
    assert.deepEqual(types, ['ForgeHosted', 'ForgeMod', 'File'])
    assert.equal(d.servers[0].modules[2].artifact.url, 'https://site/overrides/config/x.toml')
    assert.equal(reportBlocked(resolved).length, 1)
})
