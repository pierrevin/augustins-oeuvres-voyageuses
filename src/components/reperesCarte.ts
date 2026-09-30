// Repères de fond de carte : noms de pays, villes de référence, mers.
// Discrets par construction (gris, petits), ils aident à se situer sans concurrencer les données.

/** Noms français des pays, par code ISO numérique (identifiants de world-atlas). */
export const NOMS_PAYS: Record<string, string> = {
  '250': 'France', '276': 'Allemagne', '724': 'Espagne', '620': 'Portugal', '380': 'Italie', '756': 'Suisse', '040': 'Autriche',
  '056': 'Belgique', '528': 'Pays-Bas', '442': 'Lux.', '826': 'Royaume-Uni', '372': 'Irlande', '208': 'Danemark', '752': 'Suède',
  '578': 'Norvège', '246': 'Finlande', '616': 'Pologne', '203': 'Tchéquie', '703': 'Slovaquie', '348': 'Hongrie', '642': 'Roumanie',
  '100': 'Bulgarie', '300': 'Grèce', '792': 'Turquie', '191': 'Croatie', '705': 'Slovénie', '070': 'Bosnie', '688': 'Serbie',
  '008': 'Albanie', '804': 'Ukraine', '112': 'Biélorussie', '498': 'Moldavie', '440': 'Lituanie', '428': 'Lettonie', '233': 'Estonie',
  '643': 'Russie', '352': 'Islande', '196': 'Chypre', '504': 'Maroc', '012': 'Algérie', '788': 'Tunisie', '434': 'Libye',
  '818': 'Égypte', '376': 'Israël', '840': 'États-Unis', '124': 'Canada', '484': 'Mexique', '076': 'Brésil', '032': 'Argentine',
  '152': 'Chili', '604': 'Pérou', '170': 'Colombie', '862': 'Venezuela', '068': 'Bolivie', '036': 'Australie', '554': 'Nouvelle-Zélande',
  '156': 'Chine', '392': 'Japon', '410': 'Corée du Sud', '356': 'Inde', '364': 'Iran', '682': 'Arabie saoudite', '368': 'Irak',
  '760': 'Syrie', '004': 'Afghanistan', '586': 'Pakistan', '398': 'Kazakhstan', '496': 'Mongolie', '360': 'Indonésie',
  '764': 'Thaïlande', '704': 'Vietnam', '608': 'Philippines', '710': 'Afrique du Sud', '180': 'RD Congo', '231': 'Éthiopie',
  '566': 'Nigeria', '024': 'Angola', '729': 'Soudan', '148': 'Tchad', '562': 'Niger', '466': 'Mali', '478': 'Mauritanie',
  '404': 'Kenya', '834': 'Tanzanie', '450': 'Madagascar', '508': 'Mozambique', '894': 'Zambie', '516': 'Namibie', '304': 'Groenland',
}

export type Niveau = 'monde' | 'europe' | 'france'

/** Villes de référence : [nom, lat, lon, niveau à partir duquel on l'affiche]. */
export const REPERES: [string, number, number, Niveau][] = [
  ['Londres', 51.51, -0.13, 'europe'], ['Madrid', 40.42, -3.7, 'europe'], ['Lisbonne', 38.72, -9.14, 'europe'], ['Rome', 41.9, 12.5, 'europe'],
  ['Berlin', 52.52, 13.4, 'europe'], ['Bruxelles', 50.85, 4.35, 'europe'], ['Amsterdam', 52.37, 4.89, 'europe'], ['Berne', 46.95, 7.45, 'europe'],
  ['Vienne', 48.21, 16.37, 'europe'], ['Varsovie', 52.23, 21.01, 'europe'], ['Prague', 50.08, 14.44, 'europe'], ['Copenhague', 55.68, 12.57, 'europe'],
  ['Stockholm', 59.33, 18.07, 'europe'], ['Oslo', 59.91, 10.75, 'europe'], ['Dublin', 53.35, -6.26, 'europe'], ['Budapest', 47.5, 19.04, 'europe'],
  ['Athènes', 37.98, 23.73, 'europe'], ['Milan', 45.46, 9.19, 'europe'], ['Barcelone', 41.39, 2.16, 'europe'], ['Munich', 48.14, 11.58, 'europe'],
  ['Lyon', 45.75, 4.85, 'france'], ['Marseille', 43.3, 5.38, 'france'], ['Bordeaux', 44.84, -0.58, 'france'], ['Nantes', 47.22, -1.55, 'france'],
  ['Lille', 50.63, 3.06, 'france'], ['Strasbourg', 48.58, 7.75, 'france'], ['Montpellier', 43.61, 3.88, 'france'], ['Nice', 43.7, 7.27, 'france'],
  ['Rennes', 48.11, -1.68, 'france'], ['Clermont-Ferrand', 45.78, 3.08, 'france'], ['Limoges', 45.83, 1.26, 'france'], ['Dijon', 47.32, 5.04, 'france'],
  ['Brest', 48.39, -4.49, 'france'], ['Pau', 43.3, -0.37, 'france'], ['Orléans', 47.9, 1.9, 'france'], ['Rouen', 49.44, 1.1, 'france'],
  ['Reims', 49.26, 4.03, 'france'], ['Tours', 47.39, 0.69, 'france'], ['Perpignan', 42.7, 2.9, 'france'], ['Ajaccio', 41.93, 8.74, 'france'],
]

/** Mers et océans : [nom, lat, lon, niveaux où l'afficher]. */
export const MERS: [string, number, number, Niveau[]][] = [
  ['Océan Atlantique', 32, -42, ['monde']], ['Océan Pacifique', -12, -135, ['monde']], ['Océan Indien', -22, 78, ['monde']],
  ['Océan Atlantique', 45, -14, ['europe']], ['Méditerranée', 36.5, 17, ['europe']], ['Mer du Nord', 56, 3, ['europe']],
  ['Golfe de Gascogne', 45.3, -4.3, ['france']], ['Manche', 49.9, -2.6, ['france']], ['Méditerranée', 42.4, 5.2, ['france']],
]

export const RANG: Record<Niveau, number> = { monde: 0, europe: 1, france: 2 }
