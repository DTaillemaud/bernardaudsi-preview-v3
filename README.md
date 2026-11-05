# Bernardaud SI - Apercu frontend, version 3

Copie de la version 2 (`bernardaudsi-preview-v2`, commit f40a3a4) avec les retours de
Charles Bernardaud du 4 novembre 2026, appliques point par point avec Damien. Les versions 1 et 2
restent inchangees : les trois versions se comparent cote a cote.

Apercu statique francais / anglais, 19 pages internes (contre 33), navigation, images
et preferences locales. Aucun serveur, backoffice, identifiant ou document de relecture
interne n'est publie.

## Ce qui change entre la version 1 et la version 2

- Presentation : trois pages (presentation generale, histoire, outil industriel) au lieu de cinq.
- Offre : trois offres (ceramiques techniques, imprimerie serigraphique, traitements de surface et decoration) ;
  mise en forme, deliantage et frittage sont integres aux ceramiques techniques.
- Marches : defense, horlogerie, industrie ; la page defense suit la plaquette balistique.
- Materiaux : les deux alumines sont fusionnees en une page.
- Actualites : une seule page (salons et publication).
- Accueil : expertises et marches, titres et visuels seulement.
- Textes : ton affirmatif et factuel, sans renvois entre pages ni bandeau de contact repete.

Les anciennes adresses (historique, production, contenants...) redirigent vers la page qui les remplace
(`routes.js`).

## Publication

GitHub Pages : branche main, dossier racine, avec .nojekyll.
La balise `<base href>` de `index.html` et de `404.html` doit porter le nom du depot
(`/bernardaudsi-preview-v3/`).
Ce site de demonstration est public et demande a ne pas etre indexe.

Les photographies et le logo restent la propriete de leurs ayants droit.
Polices Manrope sous OFL et icones Lucide sous ISC : licences conservees dans assets.

## Version 3 : emplacements photo nommes

Chaque photo (bandeau de page ou photo a droite d'un point) est un emplacement nomme de
`content.json` > `slots` : `BAN-PRES` (bandeau), `PRES-01` a `PRES-06` (Presentation),
`HIST-01` a `HIST-05` (Histoire), etc. Un emplacement sans photo s'affiche en encart avec son nom ;
pour changer une photo, il suffit de donner le nom de l'emplacement et la nouvelle image.

- `?reperes=1` a la fin d'une adresse affiche le nom de chaque photo (retenu dans le navigateur) ;
  `?reperes=0` l'efface.
- Un emplacement accepte `image`, `caption` (fr / en), `fit` (`contain` pour un logo), `ratio` (par
  exemple `3 / 4`) et `pos` (cadrage, par exemple `60% 45%`).
- Le bandeau d'une page prend l'emplacement `BAN-<code>` ou `<code>` est le champ `ref` de la page ;
  sans photo, il reste bleu.
- La rubrique « Presentation » de la barre n'est pas cliquable (`noLink` dans `frontend.js`) : seuls
  ses trois sous-onglets le sont.
