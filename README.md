# Lazy CRA

Un formulaire statique pour créer un compte rendu d'activité mensuel et télécharger
directement son PDF A4. HTML, CSS et JavaScript natifs, sans dépendance, sans compte,
sans compilation. Interface en français, utilisable sur mobile.

## Utilisation

1. Renseigner nom et prénom, dans cet ordre sur le formulaire et le PDF.
   Le nom de famille est automatiquement mis en capitales dans le formulaire,
   le stockage local et le PDF. Cocher la mémorisation pour conserver
   l'identité dans ce navigateur.
2. Choisir éventuellement un logo (PNG, JPEG ou WebP, 5 Mo maximum).
3. Sélectionner le mois et l'année. Les jours ouvrés sont **préremplis à 1 jour
   en mission** ; les week-ends et jours fériés à 0.
4. Retirer les journées ou demi-journées non travaillées. Tous les jours restent
   modifiables, y compris les week-ends et jours fériés.
5. Télécharger le PDF : un document sobre d'une page en niveaux de gris avec
   identité, logo, détail journalier et totaux, sans les plaisanteries de
   l'interface. Le logo conserve ses couleurs d'origine. Le fond gris souligne
   uniquement les journées en mission (entières ou demi-journées) ; les jours
   sans mission restent blancs.

Le total facturé est la somme des jours en mission (0, 0,5 ou 1). Le différentiel
est le nombre de jours ouvrés hors fériés moins ce total. Il peut être négatif si
des missions le week-end ou un jour férié dépassent le nombre de jours ouvrés.
La colonne « Hors mission » du PDF indique le complément à 1 pour chaque date,
y compris les week-ends ; elle n'entre pas dans les jours imputés.

Les changements de mois et réinitialisations demandent confirmation lorsque
nécessaire. Les saisies journalières ne sont pas sauvegardées : recharger ou
quitter la page les efface.

## Calendrier open data

Les jours fériés de France métropolitaine (hors Alsace-Moselle) proviennent
exclusivement de l'[API publique officielle](https://calendrier.api.gouv.fr/jours-feries/),
via son [jeu de données métropole](https://calendrier.api.gouv.fr/jours-feries/metropole.json).
Aucune date de jour férié ni règle de calcul de Pâques n'est codée dans l'application.
L'API annonce une couverture glissante de 20 ans dans le passé et 5 ans dans le
futur ; le sélecteur utilise les années effectivement reçues.

Une connexion est nécessaire au chargement du calendrier. En cas d'échec ou de
données invalides, l'erreur est visible, un bouton permet de réessayer et l'export
reste désactivé : pas de remplacement silencieux par un calendrier approximatif.
Les week-ends sont déterminés par le calendrier natif du navigateur. Les dates
sont manipulées en heure locale, sans conversion UTC.

Le lundi de Pentecôte est initialisé comme férié ; il est modifiable s'il est
travaillé au titre de la journée de solidarité. Les ponts et congés d'entreprise
restent à saisir manuellement.

## Confidentialité

- **Ne pas ajouter de vrai logo ni d'identité au dépôt.** Importer le logo uniquement
  depuis l'interface. Aucun logo d'entreprise n'est livré avec l'application.
  Les exports PDF et les formats d'image importables sont exclus par
  `.gitignore`, ainsi que les fichiers `.env`. Ne pas forcer leur ajout avec
  `git add -f` : cette exclusion n'est pas une protection pour des fichiers
  déjà suivis par Git.
- Le logo est redimensionné et converti en JPEG sur fond blanc dans le navigateur,
  puis conservé dans `localStorage`. Il est remplaçable et supprimable.
- L'identité n'est enregistrée que si la case de mémorisation est cochée.
- Aucun nom, logo, détail journalier ou PDF n'est envoyé à un serveur.
- Le navigateur contacte GitHub Pages pour les fichiers du site et le domaine
  `calendrier.api.gouv.fr` pour les seules données publiques du calendrier
  (ces hébergeurs reçoivent les informations techniques habituelles, dont l'IP).
- Pas de police distante, de CDN, d'outil d'analyse ou de bibliothèque externe.
  Roboto (Google Fonts) est hébergée avec le site et incorporée au PDF ;
  aucune requête n'est envoyée à Google.
- Le bouton d'effacement supprime uniquement les deux entrées de cette application,
  sans toucher aux autres données du site. Un échec du stockage est signalé.
- Le stockage est propre au navigateur et à l'origine web, pas synchronisé.
  Ne pas utiliser la mémorisation sur un appareil partagé. Les autres pages d'une
  même origine, par exemple d'autres projets sous le même domaine GitHub Pages,
  peuvent techniquement accéder au même `localStorage`.
- Le PDF téléchargé contient l'identité et le logo : le conserver et le partager
  avec les précautions appropriées.

## Hébergement GitHub Pages

Dans **Settings → Pages → Build and deployment**, sélectionner **Deploy from a
branch**, puis la branche contenant ces fichiers et le dossier **/(root)**.
Les fichiers utilisent des URL relatives, adaptées à
`https://<compte>.github.io/<depot>/`. Aucun secret ni configuration serveur
n'est nécessaire.

Pour ce dépôt, l'adresse par défaut sera
`https://stanfrbd.github.io/lazy-cra/` (hors domaine personnalisé).
Conserver `index.html`, les trois modules JavaScript, `styles.css`, le dossier
`fonts/` complet et `.nojekyll` à la racine de publication. Aucun `npm install`,
build ou workflow personnalisé n'est nécessaire pour **Deploy from a branch**.
Le fichier `package.json` sert uniquement aux tests de développement.

Après activation, attendre la réussite du déploiement Pages puis vérifier le
chargement du calendrier, l'import du logo et le téléchargement d'un PDF.
Un changement d'origine (du site local vers GitHub Pages, par exemple) implique
de ressaisir l'identité et de réimporter le logo : le stockage ne suit pas le site.
Un navigateur récent est nécessaire (modules JavaScript, `fetch`,
`AbortSignal.timeout`, Canvas et `localStorage`).

## Développement et tests

Servir le dossier avec un serveur HTTP statique (les modules JavaScript ne sont
pas conçus pour l'ouverture directe en `file://`) :

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8080`. Avec Node.js 22 ou plus récent :

```powershell
node --test
```

Les tests utilisent un petit instantané officiel comme fixture, sans accès réseau.
Le générateur PDF natif incorpore Roboto Regular et Bold avec l'encodage WinAnsi :
les accents français sont pris en charge ; les caractères hors de ce jeu
(notamment certains alphabets et les emoji) sont remplacés par `?` dans le PDF.

Les fichiers TrueType statiques de Roboto proviennent de Google Fonts
([Regular](https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf),
[Bold](https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammT.ttf)).
Ils sont distribués sous [SIL Open Font License 1.1](fonts/OFL.txt).
Les métriques du PDF dans `fonts/roboto-metrics.json` sont extraites de ces
fichiers (unités ramenées à 1000, largeurs des caractères WinAnsi 32 à 255).
En cas de remplacement des polices, régénérer les métriques correspondantes.

## Licence

Code sous [licence MIT](LICENSE), copyright 2026 stanfrbd.
Les polices Roboto restent sous [SIL Open Font License 1.1](fonts/OFL.txt).
Les logos importés par les utilisateurs ne font pas partie du dépôt et ne
sont pas couverts par la licence de ce projet.
