#!/usr/bin/env python3
"""Audit de redistribution des mods d'un modpack CurseForge.

Usage :
    python audit_licences.py manifest.json VOTRE_CLE_API

La cle API CurseForge est gratuite : https://console.curseforge.com
Le script ne telecharge aucun mod. Il interroge seulement l'API
et ecrit un fichier licences.csv (ouvrable dans Excel).
"""
import csv
import json
import sys
import urllib.error
import urllib.request

API = "https://api.curseforge.com/v1"


def post(path, key, body):
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "x-api-key": key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)["data"]
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            sys.exit("Cle API refusee par CurseForge. Verifie qu'elle est complete.")
        sys.exit(f"Erreur HTTP {e.code} sur {path}")


def chunks(items, size):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def main():
    if len(sys.argv) != 3:
        sys.exit("Usage : python audit_licences.py manifest.json VOTRE_CLE_API")

    with open(sys.argv[1], encoding="utf-8") as fh:
        manifest = json.load(fh)
    key = sys.argv[2].strip()
    files = manifest["files"]
    print(f"{len(files)} mods dans le manifest. Interrogation de CurseForge...")

    mods = {}
    for part in chunks([f["projectID"] for f in files], 50):
        for m in post("/mods", key, {"modIds": part}):
            mods[m["id"]] = m

    file_info = {}
    for part in chunks([f["fileID"] for f in files], 50):
        for fi in post("/mods/files", key, {"fileIds": part}):
            file_info[fi["id"]] = fi

    rows = []
    for f in files:
        m = mods.get(f["projectID"])
        fi = file_info.get(f["fileID"])
        if not m:
            rows.append(["(introuvable)", "", f["projectID"], "", "", "VERIFIER"])
            continue
        allow = m.get("allowModDistribution")
        has_url = bool(fi and fi.get("downloadUrl"))
        if allow is False or not has_url:
            verdict = "RESTREINT"
        elif allow is None:
            verdict = "VERIFIER"
        else:
            verdict = "OK"
        rows.append(
            [
                m["name"],
                ", ".join(a["name"] for a in m.get("authors", [])),
                m["links"].get("websiteUrl", ""),
                {True: "oui", False: "non", None: "inconnu"}[allow],
                "oui" if has_url else "non",
                verdict,
            ]
        )

    rows.sort(key=lambda r: ({"RESTREINT": 0, "VERIFIER": 1, "OK": 2}[r[5]], r[0].lower()))

    with open("licences.csv", "w", newline="", encoding="utf-8-sig") as out:
        w = csv.writer(out, delimiter=";")
        w.writerow(["Mod", "Auteur", "Page", "Distribution autorisee", "Lien de telechargement API", "Verdict"])
        w.writerows(rows)

    counts = {}
    for r in rows:
        counts[r[5]] = counts.get(r[5], 0) + 1
    print("Resultat :", counts)
    print("Fichier ecrit : licences.csv")
    for r in rows:
        if r[5] == "RESTREINT":
            print(" - RESTREINT :", r[0])


if __name__ == "__main__":
    main()
