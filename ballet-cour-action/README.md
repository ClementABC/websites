# Quiz 2 — Du ballet de cour au ballet d'action

Quiz interactif pour les étudiants de Mathieu en anthropologie de la danse (Université Paris 8).

## Contenu
- 11 questions interactives en français
- 5 phases : Identification, Chronologie, Définitions, Noverre, Œuvres
- Types de questions : QCM, classement, matching, word cloud, sélection multiple
- Dashboard enseignant à `?mode=teacher` (mot de passe: Tixi)

## Backend
- **Google Sheet** : "Quiz 2 — Ballet Cour à Action — Résultats"
  - ID: `1qzX4VKHRXPYR-R_daOFVdnEfIMKOUkLLEgjKDHjLwkM`
  - URL: https://docs.google.com/spreadsheets/d/1qzX4VKHRXPYR-R_daOFVdnEfIMKOUkLLEgjKDHjLwkM/edit
- **Google Apps Script** : Voir `google-apps-script.js`
  - Déployer comme Web App (Exécuter en tant que: Moi, Accès: Tout le monde)
  - Copier l'URL de déploiement dans `index.html` (remplacer `YOUR_DEPLOYMENT_ID`)

## Déploiement Vercel
1. Créer un nouveau projet Vercel
2. Connecter au repo `ClementABC/websites`
3. Root Directory: `ballet-cour-action`
4. Framework Preset: Other
5. Deploy

## Structure des données
Le quiz sauvegarde dans localStorage et envoie à Google Sheets :
- **Sessions** : nom, date, score, pourcentage, temps, breakdown par phase
- **Answers** : nom, question #, texte question, réponse élève, bonne réponse, résultat ✓/✗, points

Format amélioré avec texte en clair (pas d'IDs) pour lisibilité par Mathieu.
