# Les Augustins hors les murs

Refonte du tableau de bord des prêts du musée des Augustins (Toulouse), réalisée pour le cours de datavisualisation de l'EBD.

Trois onglets :

- **Œuvres voyageuses** (grand public) : jeu « Où est-elle partie ? », carnets de voyage animés, galerie, passeport.
- **Tableau de bord** (équipes du musée) : indicateurs filtrables, frise, carte, œuvres hors les murs à une date donnée, classements, table exportable en CSV.
- **Coulisses des données** (pédagogie) : sources, méthode, verdict, effet du nettoyage, incohérences, limites.

## Données

Open Data Toulouse Métropole, Licence Ouverte v2.0 :

- [25 ans de prêts des collections du musée des Augustins](https://data.toulouse-metropole.fr/explore/dataset/prets-des-collections-du-musee-des-augustins/)
- [Inventaire des collections du musée des Augustins](https://data.toulouse-metropole.fr/explore/dataset/inventaire-collections-augustins/)
- [Inventaire des œuvres déposées au musée des Augustins](https://data.toulouse-metropole.fr/explore/dataset/inventaire-des-oeuvres-deposees-au-musee-des-augustins/)

## Architecture

Pas de base de données.

- `api/data.ts` : fonction serverless Vercel. Elle interroge l'API Explore v2.1, lance le pipeline et renvoie un JSON unique, en cache 24 h sur le CDN.
- `lib/pipeline.ts` : nettoyage, jointure prêts / inventaire / dépôts, vérification des images, audit qualité. Chaque règle est commentée.
- `lib/geo.ts` : seul référentiel maintenu à la main (coordonnées des villes, corrections de lieux). Une ville nouvelle apparaît dans l'onglet Coulisses (« Villes non géocodées ») : il suffit de l'ajouter ici.
- `src/` : front React + Vite, cartes et graphiques en D3.

## Développement

```bash
npm install
npx vercel dev   # front + fonction /api/data
npm run build
```

Chaque push sur `main` est déployé automatiquement sur Vercel.
