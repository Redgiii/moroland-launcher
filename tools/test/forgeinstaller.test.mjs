import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const fi = createRequire(import.meta.url)('../../app/assets/js/forgeinstaller.js')

const mod = (base) => ({
    id: 'net.minecraftforge:forge:1.20.1-47.4.10:universal',
    artifact: { url: `${base}/forge-1.20.1-47.4.10-universal.jar` }
})

test('forgeInfo derives version id and installer url', () => {
    const i = fi.forgeInfo('1.20.1', mod('https://maven.example'))
    assert.equal(i.versionId, '1.20.1-forge-47.4.10')
    assert.equal(i.forgeVersion, '47.4.10')
    assert.equal(i.installerUrl, 'https://maven.example/forge-1.20.1-47.4.10-installer.jar')
})

test('forgeInfo rejects a url that is not a universal jar', () => {
    assert.throws(() => fi.forgeInfo('1.20.1', { id: 'a:b:1.20.1-1.0', artifact: { url: 'https://x/y.jar' } }))
})

test('forgeLibraries keys match the Mojang format and skip entries without path', () => {
    const libs = fi.forgeLibraries({ libraries: [
        { name: 'org.ow2.asm:asm:9.5', downloads: { artifact: { path: 'org/ow2/asm/asm/9.5/asm-9.5.jar' } } },
        { name: 'net.minecraftforge:forge:1.20.1-47.4.10:universal', downloads: { artifact: { path: 'net/minecraftforge/forge/x/forge-universal.jar' } } },
        { name: 'no:path:1', downloads: {} }
    ] }, '/lib')
    assert.deepEqual(Object.keys(libs), ['org.ow2.asm:asm', 'net.minecraftforge:forge:1.20.1-47.4.10'])
    assert.ok(libs['org.ow2.asm:asm'].endsWith('asm-9.5.jar'))
})

test('ensureForge downloads the installer, runs it, writes a marker, and is idempotent', async (t) => {
    const server = createServer((req, res) => {
        res.end(req.url.endsWith('-installer.jar') ? 'fake-installer' : 'nope')
    })
    await new Promise(r => server.listen(0, '127.0.0.1', r))
    t.after(() => server.close())
    const base = `http://127.0.0.1:${server.address().port}`
    const dir = mkdtempSync(join(tmpdir(), 'forge-'))
    const common = join(dir, 'common')
    const java = join(dir, 'fakejava.sh')
    // Behaves like `java -jar <jar> --installClient <dir>`: needs launcher_profiles.json, writes the version json.
    writeFileSync(java, `#!/bin/sh
[ "$1" = "-jar" ] && [ "$3" = "--installClient" ] || exit 2
[ -f "$4/launcher_profiles.json" ] || exit 3
mkdir -p "$4/versions/1.20.1-forge-47.4.10"
echo '{"id":"1.20.1-forge-47.4.10"}' > "$4/versions/1.20.1-forge-47.4.10/1.20.1-forge-47.4.10.json"
`)
    chmodSync(java, 0o755)
    const args = { commonDir: common, javaExe: java, mcVersion: '1.20.1', rawModule: mod(base) }
    assert.equal(await fi.ensureForge(args), true)
    assert.equal(await fi.isForgeInstalled(common, '1.20.1-forge-47.4.10'), true)
    assert.equal(existsSync(join(common, 'forge-installer')), false, 'temp installer is cleaned up')
    assert.equal(JSON.parse(readFileSync(join(common, 'launcher_profiles.json'))).profiles !== undefined, true)
    assert.equal(await fi.ensureForge(args), false)
})

test('ensureForge surfaces installer failures', async (t) => {
    const server = createServer((req, res) => res.end('x'))
    await new Promise(r => server.listen(0, '127.0.0.1', r))
    t.after(() => server.close())
    const dir = mkdtempSync(join(tmpdir(), 'forge-'))
    const java = join(dir, 'badjava.sh')
    writeFileSync(java, '#!/bin/sh\necho boom >&2\nexit 1\n')
    chmodSync(java, 0o755)
    await assert.rejects(
        fi.ensureForge({ commonDir: join(dir, 'c'), javaExe: java, mcVersion: '1.20.1', rawModule: mod(`http://127.0.0.1:${server.address().port}`) }),
        /code 1[\s\S]*boom/)
})
