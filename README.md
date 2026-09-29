# Portfolio — Amine Dahmane

Site statique (aucune étape de build) exporté de Claude Design.

| Fichier | Rôle |
|---|---|
| `index.html` | Le portfolio |
| `support.js` | Runtime Claude Design (charge React depuis unpkg) — ne pas modifier |
| `data/experiences.json` | **Tes expériences** — lues par `index.html` au chargement |
| `admin.html` | Mini CRUD pour gérer `data/experiences.json` |
| `assets/` | Logo |

## Gérer les expériences

`admin.html` n'est **pas** publiée (voir `.gitignore`) : elle n'existe que sur ton PC.
Lance `npx serve .` dans ce dossier, ouvre `http://localhost:3000/admin.html`, puis :

- **Ajouter / Modifier / Supprimer / ↑↓** : les changements sont gardés en brouillon dans ton navigateur.
- **Publier sur GitHub** : écrit `data/experiences.json` directement dans le dépôt via l'API GitHub → Pages redéploie en ~1 min.
  - Une seule fois : *Réglages GitHub* → propriétaire, dépôt, branche, et un **fine-grained token**
    (GitHub → Settings → Developer settings → Fine-grained tokens → *Only select repositories* : ce dépôt → *Contents : Read and write*).
  - Le jeton reste dans le `localStorage` de ton navigateur : n'utilise cette page que sur ton ordinateur.
- **Alternative sans jeton** : *Télécharger JSON* → remplace `data/experiences.json` → `git commit` + `git push`.

Format d'une expérience :

```json
{
  "company": "MTL Héros du Terrain",
  "org": "OBNL montréalais",
  "role": "Développeur",
  "dates": "Mai 2025 — Présent",
  "tags": ["Next.js", "TypeScript"],
  "bullets": ["Une réalisation", "Une autre"]
}
```

## Tester en local

`fetch()` ne marche pas en `file://`, il faut un petit serveur :

```bash
npx serve .        # ou : python -m http.server 8000
```

## Déployer sur GitHub Pages

```bash
git init
git add .
git commit -m "Portfolio initial"
git branch -M main
gh repo create DHMPROG.github.io --public --source=. --push
# (sans gh : crée le dépôt sur github.com puis
#  git remote add origin https://github.com/DHMPROG/DHMPROG.github.io.git && git push -u origin main)
```

Puis sur GitHub : **Settings → Pages → Build and deployment → Source : Deploy from a branch → `main` / `(root)` → Save**.

- Dépôt nommé `DHMPROG.github.io` → site à `https://dhmprog.github.io/`
- Autre nom (ex. `portfolio`) → `https://dhmprog.github.io/portfolio/`
- Domaine perso : Settings → Pages → *Custom domain*, + un enregistrement DNS `CNAME` vers `dhmprog.github.io`. Coche *Enforce HTTPS*.

Chaque `git push` (ou publication depuis `admin.html`) redéploie automatiquement.
