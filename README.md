# Portfolio — Amine Dahmane

Site statique, un seul fichier, aucune étape de build : un portfolio en forme d'éditeur de code (arborescence, barre d'état vim, ligne de commande).

| Fichier | Rôle |
|---|---|
| `index.html` | Le portfolio (HTML, CSS et JS dans un seul fichier, aucune dépendance) |
| `data/experiences.json` | **Tes expériences** — lues par `index.html` au chargement, affichées dans `log.txt` |
| `admin.html` | Mini CRUD pour gérer `data/experiences.json` (local seulement) |
| `assets/` | Logo et CV (FR et EN) |

### Raccourcis du site

- `j` / `k` : défiler · `g` / `G` : haut / bas · `1`–`5` : sauter à une section
- `:` ouvre la ligne de commande avec une boîte de suggestions façon IDE : recherche floue (`:cvcan` → `cv2.Canny`), `↑` `↓` pour choisir, `Tab` pour compléter, `Entrée` pour lancer, `Échap` pour fermer. Le panneau de droite décrit la commande sélectionnée.
- Commandes disponibles : `:theme papier|nuit`, `:lang fr|en`, `:matrix`, `:boom`, `:help`
- `:help` liste toutes les commandes dans le terminal. Les principales :
  - **Actions** : `:cv` (ouvre le CV), `:mail` (copie le courriel), `:open heros|appstore|nest|abdian|github|linkedin`, `:qr` (QR code vers le site), `:cast` (envoi simulé vers un Nest Hub)
  - **Terminal** : `:whoami`, `:stats`, `:book 20` (test de concurrence sur la démo des places), `:git log` (vrais commits via l'API GitHub), `:ls`, `:cat README.md|projects|log.txt|stack.toml|contact.sh`, `:top` (`q` pour quitter)
  - **Fun** : `:snake` (flèches / WASD / glisser), `:sudo hire amine`, `:coffee`, `:konami` (indice du thème secret ↑↑↓↓←→←→BA), `:matrix`, `:boom`
- Commandes OpenCV (`:help cv2`), dont `:cv2.face_detect`, `:cv2.dilate`, `:cv2.erode` : `:cv2.Canny`, `:cv2.Sobel`, `:cv2.GaussianBlur`, `:cv2.threshold`, `:cv2.cvtColor`, `:cv2.bitwise_not`, `:cv2.resize` filtrent toute la page ; `:cv2.detect` encadre les éléments visibles avec des boîtes de détection ; `:cv2.track` suit le curseur ; `:cv2.reset` remet tout. La syntaxe complète marche aussi : `:cv2.Canny(page, 100, 200)`, `:import cv2`.
- Thème : **papier** (clair) ou **nuit** (sombre). Par défaut, suit le réglage clair/sombre de l'appareil ; un clic sur ☀ / ☾ mémorise le choix.
- Bouton **FR / EN** en bas à droite (choix mémorisé dans le navigateur)

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
  "bullets": ["Une réalisation", "Une autre"],
  "en": {
    "org": "Montréal non-profit",
    "role": "Developer",
    "dates": "May 2025 - Present",
    "tags": ["Next.js", "TypeScript"],
    "bullets": ["An achievement", "Another one"]
  }
}
```

Le bloc `en` est optionnel : il est affiché quand le visiteur choisit **EN** (bouton FR / EN du menu). Un champ absent reprend la version française.

Les autres textes du site (FR et EN) sont dans `index.html`, objet `window.I18N` (clés `fr` et `en`). La session de stage est la clé `session`.

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
