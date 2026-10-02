/**
 * Moroland: client-side Forge installation.
 *
 * The launcher never hosts files derived from Minecraft. Instead, it downloads the official Forge
 * installer from the Forge maven and runs it on the player's machine (`--installClient`).
 * The installer writes the Forge libraries and the version json inside the launcher's common directory.
 */
const { spawn }  = require('child_process')
const fs         = require('fs-extra')
const path       = require('path')
const { Readable } = require('stream')
const { pipeline } = require('stream/promises')

const MARKER = '.moroland-forge-installed'

/**
 * Derive everything we need from the ForgeHosted module of the distribution.
 *
 * @param {string} mcVersion Minecraft version, ex. 1.20.1
 * @param {{id: string, artifact: {url: string}}} rawModule The raw ForgeHosted module.
 */
function forgeInfo(mcVersion, rawModule) {
    // Module id: net.minecraftforge:forge:1.20.1-47.4.10[:universal]
    const parts = rawModule.id.split(':')
    const forgeVersion = parts[2].split('-')[1]
    const versionId = `${mcVersion}-forge-${forgeVersion}`
    const installerUrl = rawModule.artifact.url.replace(/-universal\.jar$/, '-installer.jar')
    if (installerUrl === rawModule.artifact.url) {
        throw new Error(`ForgeHosted artifact url must end with -universal.jar (got ${rawModule.artifact.url})`)
    }
    return { forgeVersion, versionId, installerUrl }
}

function versionJsonPath(commonDir, versionId) {
    return path.join(commonDir, 'versions', versionId, `${versionId}.json`)
}

function markerPath(commonDir, versionId) {
    return path.join(commonDir, 'versions', versionId, MARKER)
}

// The installer refuses to run if the official launcher's profile file is missing.
function launcherProfilesContent() {
    return JSON.stringify({
        profiles: {},
        clientToken: 'moroland',
        launcherVersion: { name: 'moroland', format: 21, profilesFormat: 2 }
    })
}

async function isForgeInstalled(commonDir, versionId) {
    return (await fs.pathExists(markerPath(commonDir, versionId)))
        && (await fs.pathExists(versionJsonPath(commonDir, versionId)))
}

async function downloadFile(url, dest) {
    const res = await fetch(url)
    if (!res.ok || res.body == null) {
        throw new Error(`Download failed (HTTP ${res.status}): ${url}`)
    }
    await fs.ensureDir(path.dirname(dest))
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest))
}

function runInstaller(javaExe, installerJar, commonDir, log) {
    return new Promise((resolve, reject) => {
        const proc = spawn(javaExe, ['-jar', installerJar, '--installClient', commonDir], {
            cwd: path.dirname(installerJar),
            windowsHide: true
        })
        let tail = ''
        const onData = d => {
            const s = d.toString('utf8')
            tail = (tail + s).slice(-4000)
            log(s.trim())
        }
        proc.stdout.on('data', onData)
        proc.stderr.on('data', onData)
        proc.on('error', reject)
        proc.on('close', code => {
            if (code === 0) {
                resolve()
            } else {
                reject(new Error(`Forge installer exited with code ${code}.\n${tail.split('\n').slice(-8).join('\n')}`))
            }
        })
    })
}

/**
 * Install Forge if it is not installed yet. Safe to call at each launch.
 *
 * @returns {Promise<boolean>} true if an installation was performed.
 */
async function ensureForge({ commonDir, javaExe, mcVersion, rawModule, log = () => {} }) {
    const info = forgeInfo(mcVersion, rawModule)
    if (await isForgeInstalled(commonDir, info.versionId)) {
        return false
    }
    const tmpDir = path.join(commonDir, 'forge-installer')
    const installerJar = path.join(tmpDir, `forge-${mcVersion}-${info.forgeVersion}-installer.jar`)
    try {
        await fs.ensureDir(commonDir)
        const profiles = path.join(commonDir, 'launcher_profiles.json')
        if (!(await fs.pathExists(profiles))) {
            await fs.writeFile(profiles, launcherProfilesContent(), 'utf8')
        }
        log(`Downloading ${info.installerUrl}`)
        await downloadFile(info.installerUrl, installerJar)
        await runInstaller(javaExe, installerJar, commonDir, log)
        if (!(await fs.pathExists(versionJsonPath(commonDir, info.versionId)))) {
            throw new Error(`Forge installer finished but ${info.versionId}.json is missing.`)
        }
        await fs.writeFile(markerPath(commonDir, info.versionId), new Date().toISOString(), 'utf8')
    } finally {
        await fs.remove(tmpDir).catch(() => {})
    }
    return true
}

async function loadForgeVersionJson(commonDir, versionId) {
    return fs.readJson(versionJsonPath(commonDir, versionId), 'utf-8')
}

/**
 * Libraries declared by the Forge version json, as {versionlessId: absolutePath}.
 * Same key format as the Mojang libraries, so Forge's versions override Mojang's.
 */
function forgeLibraries(modManifest, libPath) {
    const libs = {}
    for (const lib of modManifest.libraries ?? []) {
        const rel = lib.downloads?.artifact?.path
        if (rel == null) {
            continue
        }
        libs[lib.name.substring(0, lib.name.lastIndexOf(':'))] = path.join(libPath, rel)
    }
    return libs
}

module.exports = {
    forgeInfo,
    versionJsonPath,
    launcherProfilesContent,
    isForgeInstalled,
    ensureForge,
    loadForgeVersionJson,
    forgeLibraries
}
