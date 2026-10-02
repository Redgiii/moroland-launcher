# Guide Moroland Launcher (pour l'administrateur)

Ce guide liste ce qu'il te reste à faire toi-même. Ce sont des actions sur tes comptes.

## 1. Activer GitHub Pages (2 minutes)

1. Ouvre `Settings` > `Pages` du dépôt.
2. Dans `Source`, choisis `GitHub Actions`.

Le fichier `distribution.json` sera publié à `https://redgiii.github.io/moroland-launcher/distribution.json`.

## 2. Ajouter la clé CurseForge (quand tu la reçois)

1. `Settings` > `Secrets and variables` > `Actions` > `New repository secret`.
2. Nom : `CF_API_KEY`. Valeur : ta clé.
3. Onglet `Actions` > `Publish distribution` > `Run workflow`.

Le workflow lit la liste des mods, trouve pour chacun une URL officielle (Modrinth d'abord, CurseForge ensuite), puis publie le fichier.
Il n'envoie aucun mod nulle part.

Les mods dont l'auteur interdit la distribution tierce sont listés dans `blocked.json` (même dossier Pages). Le launcher ne les télécharge pas.
Il faudra soit les retirer du pack, soit demander à l'auteur, soit les faire télécharger à la main.

## 3. Connexion Microsoft (obligatoire pour jouer en ligne)

Sans cette étape, le bouton de connexion ne marchera pas.

1. Crée une application sur https://entra.microsoft.com (`App registrations` > `New registration`).
2. Type de compte : `Personal Microsoft accounts only`.
3. Redirect URI : plateforme `Mobile and desktop applications`, valeur `https://login.microsoftonline.com/common/oauth2/nativeclient`.
4. Copie l'`Application (client) ID`.
5. Remplis le formulaire d'approbation Minecraft : https://aka.ms/mce-reviewappid. L'approbation prend des jours.
6. Remplace la valeur dans `app/assets/js/ipcconstants.js` (`AZURE_CLIENT_ID`).

Détails : `docs/MicrosoftAuth.md`.

## 4. Lien Discord

Dans `app/assets/lang/_custom.toml`, remplace `mediaDiscordURL = "#"` par ton lien d'invitation.

## 5. Publier une version du launcher

```
git tag v0.1.0
git push origin v0.1.0
```

GitHub construit les installateurs Windows, macOS et Linux. Ils apparaissent dans `Releases`.
Un tag avec un tiret (`v0.1.0-beta.1`) crée une pré-version.

## 6. Mettre à jour le pack de mods

1. Remplace `pack/manifest.json` par celui du nouveau export CurseForge.
2. Mets à jour `pack/overrides/config` si besoin.
3. Pousse sur `main`. Le workflow republie le fichier.

Les joueurs récupèrent la mise à jour au prochain lancement.
Pour changer de version de Forge : modifie `pack/server.json` (`loader`).

## À savoir

- **Installateurs non signés.** Windows affiche SmartScreen (`Informations complémentaires` > `Exécuter quand même`). macOS demande un clic droit > `Ouvrir`. Une signature coûte de l'argent. Tu as dit « gratuit », donc on s'en passe.
- **Configs forcées.** Les fichiers de `pack/overrides/config` sont remis à l'identique à chaque lancement. Les réglages modifiés par un joueur dans ces fichiers sont écrasés.
- **Images de fond.** Le dépôt est public. Vérifie que tu as le droit d'utiliser tes 3 images.
- **Java.** Le launcher installe Java 21 (Temurin) tout seul.
- **Forge.** Au premier lancement, le launcher exécute l'installateur officiel de Forge (1 à 3 minutes). Les tests automatiques le vérifient sous Windows, macOS et Linux.
