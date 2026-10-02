# Moroland Launcher

Launcher for the Moroland community Minecraft server (1.20.1, Forge 47.4.10, Java 21).

Based on [Helios Launcher](https://github.com/dscalzi/HeliosLauncher) by Daniel Scalzi, used under the MIT license (see `LICENSE.txt`).

## How mods are handled

This project does **not** host or redistribute any mod.

- Each mod is downloaded by the player directly from its official source: the Modrinth CDN, or the CurseForge CDN when the author allows third-party distribution through the CurseForge API.
- A mod whose author does not allow this is never fetched by the launcher. It is listed in a report so the player can get it from the author's page.
- Forge is installed on the player's machine with the official Forge installer. No file derived from Minecraft is hosted here.
- The only files published by this repository are the distribution index (a list of URLs and hashes) and the modpack's own configuration files.

## Repository layout

| Path | Purpose |
| --- | --- |
| `app/`, `index.js` | The launcher (Electron), forked from Helios |
| `tools/` | Scripts that generate the distribution index from the modpack manifest |
| `pack/` | Modpack manifest and configuration overrides |
| `audit_licences.py` | Read-only script that checks, through the CurseForge API, which mods allow third-party distribution. It downloads nothing. |
| `.github/workflows/` | Automatic builds (Windows, Linux, macOS) and index publication |

## Goal

A simple launcher so players can install the modpack easily, while respecting mod authors' distribution settings.
