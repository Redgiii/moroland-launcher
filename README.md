# Moroland Launcher

Tools for the Moroland community Minecraft server (1.20.1, Forge).

## audit_licences.py
Read-only script. It reads the manifest.json of our own CurseForge modpack and, for each mod, checks via the CurseForge API whether the author allows third-party distribution. It downloads no files and redistributes nothing. Mods flagged as restricted are never redistributed by us.

## Goal
A simple launcher so players can install the modpack easily, while respecting mod authors' distribution settings.
