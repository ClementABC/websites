# Quiz Danse — site statique (Vercel)

Le quiz de Mathieu en site 100 % statique : `index.html` + `styles.css` +
`app.js` + `config.js`. Pas de serveur, pas de base de données —
les questions, les réponses et les réglages vivent dans la Google Sheet
via le script Apps Script (v5).

## Mise en route (Clement, ~10 minutes)

### 1. Coller le backend dans la Sheet

Dans le dossier `quiz-resultats-mathieu/` (à côté de celui-ci) :

1. Ouvre la Google Sheet **Quiz Danse — Mathieu** → **Extensions** → **Apps Script**
2. Supprime le code existant, colle tout le contenu de **Code.gs (v5)**
3. Enregistre, puis exécute la fonction **creerFeuilles** une fois
   (autorise quand Google le demande)
4. Vérifie les 4 onglets : **Questions**, **Sessions**, **Answers**, **Config**

### 2. Déployer l'application web

1. Dans l'éditeur Apps Script : **Déployer** → **Nouveau déploiement**
2. ⚙️ → **Application web**
3. **Exécuter en tant que** : Moi — **Qui a accès** : Tous les utilisateurs
4. **Déployer**, puis **copier l'URL** de l'application web

### 3. Brancher le site

1. Ouvre `config.js` dans ce dossier
2. Remplace `COLLE_TON_URL_ICI` par l'URL copiée (entre les guillemets)
3. Mets l'adresse de la Sheet dans `sheet_url` (facultatif)

### 4. Déployer sur Vercel

Option A — glisser-déposer : https://vercel.com/new → importe ce dossier.
Option B — GitHub : pousse ce dossier dans un repo, puis **Add New → Project**
dans Vercel en le reliant au repo (chaque push redéploie automatiquement).

### 5. Premier passage dans l'Espace prof

1. Ouvre le site déployé → **Espace prof**
2. Crée le **code prof** (min. 4 caractères) — il est stocké dans l'onglet
   **Config** de la Sheet, jamais dans le site
3. Ouvre les chapitres au fur et à mesure dans **Réglages**
   (chapitre 1 ouvert par défaut)

## Tester en local

```bash
cd quiz-danse-vercel
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

Le site affiche « Le quiz n'est pas encore branché » tant que `config.js`
contient le placeholder — c'est normal.

## Fichiers

| Fichier      | Rôle                                                        |
|--------------|-------------------------------------------------------------|
| `index.html` | Coquille : barre de navigation + conteneur de l'appli       |
| `styles.css` | Design papier chaud, Atkinson Hyperlegible, mobile-first    |
| `app.js`     | Toute l'appli : quiz élève + espace prof (vanilla JS)       |
| `config.js`  | **Le seul fichier à modifier** : URL du backend + Sheet     |
| `fonts/`     | Atkinson Hyperlegible (400/700, woff2, ~35 Ko)              |

## Règles produit (ne pas changer sans Mathieu)

- L'élève ne voit **rien** après l'envoi : juste « Merci ! Ton quiz est terminé. »
  Pas de score, pas de correction, pas d'explications.
- 7 chapitres, ouverts un par un après le cours en classe.
- 5 types de questions : qcm, vrai_faux, curseur (non noté),
  classement, texte (non noté).
- Les questions viennent de la Sheet — jamais celles d'Ines.

## Notes techniques

- Appels backend : `POST` JSON `{action, args}` en `text/plain`
  (même contrat que `exemple-appel.js`), avec boucle manuelle
  de suivi des 302 d'Apps Script.
- Le code prof est vérifié par `verify_teacher_code` et gardé
  **en mémoire uniquement** (jamais dans localStorage).
- `get_config` ne renvoie jamais le code prof.
- `set_config` exige le code actuel (sauf à la toute première création).
