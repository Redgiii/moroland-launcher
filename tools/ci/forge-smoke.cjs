// Real-world check: runs the official Forge installer through our own code, then verifies that every
// library of the Forge version json exists on disk (those paths end up on the game's classpath).
const fs = require('fs')
const os = require('os')
const path = require('path')
const fi = require('../../app/assets/js/forgeinstaller.js')

;(async () => {
    const server = JSON.parse(fs.readFileSync(path.join(__dirname, '../../pack/server.json'), 'utf8'))
    const [group, artifact, version] = server.loader.id.split(':')
    const rawModule = {
        id: `${group}:${artifact}:${version}:universal`,
        artifact: { url: server.loader.url.replace(/-installer\.jar$/, '-universal.jar') }
    }
    const commonDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moroland-common-'))
    const javaExe = process.env.JAVA_EXE || 'java'
    const t0 = Date.now()
    const installed = await fi.ensureForge({ commonDir, javaExe, mcVersion: server.minecraftVersion, rawModule, log: m => m && console.log('  [forge]', m) })
    console.log(`installed=${installed} in ${Math.round((Date.now() - t0) / 1000)}s`)

    const info = fi.forgeInfo(server.minecraftVersion, rawModule)
    const json = await fi.loadForgeVersionJson(commonDir, info.versionId)
    const libs = fi.forgeLibraries(json, path.join(commonDir, 'libraries'))
    const missing = Object.entries(libs).filter(([, p]) => !fs.existsSync(p))
    console.log(`libraries: ${Object.keys(libs).length}, missing: ${missing.length}`)
    missing.slice(0, 20).forEach(([k, p]) => console.log('  MISSING', k, p))
    const universal = path.join(commonDir, 'libraries', 'net/minecraftforge/forge', version, `forge-${version}-universal.jar`)
    console.log('universal jar present:', fs.existsSync(universal))
    console.log('mainClass:', json.mainClass, '| jvm args:', (json.arguments?.jvm ?? []).length, '| game args:', (json.arguments?.game ?? []).length)
    if (missing.length > 0 || !fs.existsSync(universal) || await fi.ensureForge({ commonDir, javaExe, mcVersion: server.minecraftVersion, rawModule }) !== false) {
        process.exit(1)
    }
})().catch(e => { console.error(e); process.exit(1) })
