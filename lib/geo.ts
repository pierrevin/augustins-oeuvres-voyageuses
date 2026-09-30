// Référentiels géographiques maintenus à la main.
// Le jeu de prêts ne contient pas de coordonnées : chaque ville a été géocodée une fois
// (API Open-Meteo, contrôle manuel des homonymes), puis figée ici.

/** Corrections appliquées aux couples ville|pays bruts du jeu de prêts. */
export const CORRECTIONS_LIEUX: Record<string, { ville?: string; pays?: string; motif: string }> = {
  'Hambourg|France': { pays: 'Allemagne', motif: 'Hambourg classée en France' },
  'Lisle-sur-Tarn|Suisse': { pays: 'France', motif: 'Lisle-sur-Tarn (Tarn) classée en Suisse' },
  'Montréal|France': { pays: 'Canada', motif: 'Montréal classée en France' },
  'Ottawa|Etats-Unis': { pays: 'Canada', motif: 'Ottawa classée aux États-Unis' },
  'Toronto|Etats-Unis': { pays: 'Canada', motif: 'Toronto classée aux États-Unis' },
  'Pérouse|France': { pays: 'Italie', motif: 'Pérouse (Galerie nationale de l’Ombrie) classée en France' },
  'Pavie|France': { pays: 'Italie', motif: 'Pavie classée en France' },
  'Berne|France': { pays: 'Suisse', motif: 'Berne classée en France' },
  'Omans|France': { ville: 'Ornans', motif: 'Faute de frappe : « Omans » pour Ornans' },
  'Apeldoom|Pays-Bas': { ville: 'Apeldoorn', motif: 'Faute de frappe : « Apeldoom » pour Apeldoorn' },
  'Rovetero|Italie': { ville: 'Rovereto', motif: 'Faute de frappe : « Rovetero » pour Rovereto' },
  'Saint-Cirq Lapopie|France': { ville: 'Saint-Cirq-Lapopie', motif: 'Traits d’union manquants' },
  'Roche-sur-Yon|France': { ville: 'La Roche-sur-Yon', motif: 'Article manquant' },
  'Roques sur Garonne|France': { ville: 'Roques', motif: 'Nom de commune non officiel' },
  'Saint-Jacques de Compostelle|Espagne': { ville: 'Saint-Jacques-de-Compostelle', motif: 'Traits d’union manquants' },
}

export const PAYS: Record<string, { iso: string; num: string; continent: string }> = {
  France: { iso: 'FR', num: '250', continent: 'Europe' },
  Allemagne: { iso: 'DE', num: '276', continent: 'Europe' },
  Andorre: { iso: 'AD', num: '020', continent: 'Europe' },
  Angleterre: { iso: 'GB', num: '826', continent: 'Europe' },
  Australie: { iso: 'AU', num: '036', continent: 'Océanie' },
  Autriche: { iso: 'AT', num: '040', continent: 'Europe' },
  Belgique: { iso: 'BE', num: '056', continent: 'Europe' },
  Canada: { iso: 'CA', num: '124', continent: 'Amérique' },
  Chypre: { iso: 'CY', num: '196', continent: 'Europe' },
  Corée: { iso: 'KR', num: '410', continent: 'Asie' },
  Danemark: { iso: 'DK', num: '208', continent: 'Europe' },
  Espagne: { iso: 'ES', num: '724', continent: 'Europe' },
  'Etats-Unis': { iso: 'US', num: '840', continent: 'Amérique' },
  Hongrie: { iso: 'HU', num: '348', continent: 'Europe' },
  Israël: { iso: 'IL', num: '376', continent: 'Asie' },
  Italie: { iso: 'IT', num: '380', continent: 'Europe' },
  Japon: { iso: 'JP', num: '392', continent: 'Asie' },
  Luxembourg: { iso: 'LU', num: '442', continent: 'Europe' },
  'Nouvelle-Zélande': { iso: 'NZ', num: '554', continent: 'Océanie' },
  'Pays-Bas': { iso: 'NL', num: '528', continent: 'Europe' },
  Pologne: { iso: 'PL', num: '616', continent: 'Europe' },
  Roumanie: { iso: 'RO', num: '642', continent: 'Europe' },
  Suisse: { iso: 'CH', num: '756', continent: 'Europe' },
  Suède: { iso: 'SE', num: '752', continent: 'Europe' },
  Turquie: { iso: 'TR', num: '792', continent: 'Europe' },
}

/** Coordonnées des villes (clé : ville corrigée|pays corrigé). */
const RAW = `Andillac|France;43.999;1.891
Lyon|France;45.7491;4.8479
Venise|Italie;45.4371;12.3326
Nancy|France;48.6844;6.185
Jérusalem|Israël;31.769;35.2163
Mont-de-Marsan|France;43.8902;-0.4971
Toulouse|France;43.6043;1.4437
Paris|France;48.8534;2.3488
Parme|Italie;44.7993;10.3262
Rome|Italie;41.8919;12.5113
Blagnac|France;43.6367;1.3897
Stuttgart|Allemagne;48.7823;9.177
Millau|France;44.0997;3.0785
Milan|Italie;45.4643;9.1895
Saint-Antoine-l'Abbaye|France;45.1667;5.2167
Nagoya|Japon;35.1815;136.9064
Turin|Italie;45.0705;7.6868
Cahors|France;44.4491;1.4366
Rodez|France;44.3526;2.5734
Saint-Jacques-de-Compostelle|Espagne;42.8805;-8.5457
Los Angeles|Etats-Unis;34.0522;-118.2437
Laval|France;48.0725;-0.7702
Montréal|Canada;45.5088;-73.5878
La Roche-sur-Yon|France;46.6697;-1.4276
Montpellier|France;43.6109;3.8763
Agen|France;44.202;0.6206
Cologne|Allemagne;50.9333;6.95
Auckland|Nouvelle-Zélande;-36.8485;174.7635
Trévise|Italie;45.6667;12.2416
Pérouse|Italie;43.11;12.39
Lisle-sur-Tarn|France;43.85;1.81
Rovereto|Italie;45.89;11.04
Lausanne|Suisse;46.52;6.63
Les Lucs-sur-Boulogne|France;46.84;-1.49
Portland|Etats-Unis;45.52;-122.68
Munich|Allemagne;48.14;11.58
Naples|Italie;40.85;14.27
Tokyo|Japon;35.69;139.69
Amsterdam|Pays-Bas;52.37;4.89
Utrecht|Pays-Bas;52.09;5.12
Budapest|Hongrie;47.50;19.04
Caen|France;49.19;-0.36
Birmingham|Etats-Unis;33.52;-86.80
Barcelone|Espagne;41.39;2.16
Baltimore|Etats-Unis;39.29;-76.61
Varsovie|Pologne;52.23;21.01
Séville|Espagne;37.38;-5.97
Hiroshima|Japon;34.40;132.45
Denver|Etats-Unis;39.74;-104.98
Saint-Cirq-Lapopie|France;44.46;1.67
Villefranche-sur-Saône|France;45.99;4.72
Bonn|Allemagne;50.73;7.10
Rouen|France;49.44;1.10
Courbevoie|France;48.90;2.26
Sydney|Australie;-33.87;151.21
Saint-Jory|France;43.74;1.37
Monsempron-Libos|France;44.49;0.94
New York|Etats-Unis;40.71;-74.01
L'Isle-Adam|France;49.11;2.23
Versailles|France;48.80;2.13
Castanet-Tolosan|France;43.52;1.50
Arc-et-Senans|France;47.03;5.77
Lavaur|France;43.70;1.81
Vic|Espagne;41.93;2.25
Madrid|Espagne;40.42;-3.70
Dijon|France;47.31;5.01
Nicosie|Chypre;35.17;33.35
Troyes|France;48.30;4.09
Nantes|France;47.22;-1.55
Bordeaux|France;44.84;-0.58
Berne|Suisse;46.95;7.45
Montauban|France;44.02;1.35
Lille|France;50.63;3.06
Williamstown|Etats-Unis;42.71;-73.20
Saragosse|Espagne;41.66;-0.88
Gênes|Italie;44.40;8.94
Londres|Angleterre;51.51;-0.13
Yokohama|Japon;35.43;139.65
Cluny|France;46.43;4.66
Ajaccio|France;41.92;8.74
Perpignan|France;42.70;2.90
Calais|France;50.95;1.86
Pau|France;43.31;-0.36
Strasbourg|France;48.58;7.75
Tours|France;47.39;0.70
Sceaux|France;48.78;2.29
Bucarest|Roumanie;44.43;26.11
Sienne|Italie;43.32;11.33
Carcassonne|France;43.22;2.35
Kiel|Allemagne;54.32;10.13
Draguignan|France;43.54;6.46
Karlsruhe|Allemagne;49.01;8.40
Dieppe|France;49.92;1.08
Valence-sur-Baïse|France;43.88;0.38
Osaka|Japon;34.69;135.50
Dallas|Etats-Unis;32.78;-96.81
Washington|Etats-Unis;38.90;-77.04
Avignon|France;43.95;4.81
Genève|Suisse;46.20;6.15
Linz|Autriche;48.31;14.29
Limoux|France;43.05;2.22
Kitakyushu|Japon;33.85;130.85
Graz|Autriche;47.07;15.44
Berlin|Allemagne;52.52;13.41
Malibu|Etats-Unis;34.03;-118.78
Mie|Japon;34.73;136.52
Figeac|France;44.61;2.03
Louisville|Etats-Unis;38.25;-85.76
Lens|France;50.43;2.83
Bergame|Italie;45.70;9.67
Marseille|France;43.30;5.38
Niort|France;46.32;-0.46
Bastia|France;42.70;9.45
Pise|Italie;43.71;10.40
Cannes|France;43.55;7.01
Albi|France;43.93;2.15
Rovigo|Italie;45.07;11.79
Stockholm|Suède;59.33;18.07
Limoges|France;45.83;1.25
Bourgoin-Jallieu|France;45.60;5.27
Gaillac|France;43.90;1.90
Meaux|France;48.96;2.88
Saint-Riquier|France;50.13;1.95
Bagnères-de-Luchon|France;42.79;0.59
Cleveland|Etats-Unis;41.50;-81.70
Luxembourg|Luxembourg;49.61;6.13
Vienne|Autriche;48.21;16.37
Udine|Italie;46.07;13.24
Reims|France;49.27;4.03
Granville|France;48.84;-1.60
Valence|France;44.93;4.91
Saint-Tropez|France;43.27;6.64
Lodève|France;43.73;3.32
Ferrare|Italie;44.84;11.62
Kyoto|Japon;35.02;135.75
Ahlen|Allemagne;51.76;7.89
Saint-Maur-des-Fossés|France;48.79;2.49
Canberra|Australie;-35.28;149.13
Pavie|Italie;45.19;9.16
Saint-Cyr-sur-Morin|France;48.91;3.18
Cassel|France;50.80;2.49
Reggio Emilia|Italie;44.70;10.63
Charlottenlund|Danemark;55.75;12.57
Libourne|France;44.91;-0.24
Chicago|Etats-Unis;41.85;-87.65
Douai|France;50.37;3.08
Matsue|Japon;35.48;133.05
Hambourg|Allemagne;53.55;9.99
San Francisco|Etats-Unis;37.77;-122.42
Grasse|France;43.66;6.93
Fronton|France;43.84;1.39
Roanne|France;46.04;4.07
Bilbao|Espagne;43.26;-2.93
Ornans|France;47.11;6.14
Remagen|Allemagne;50.58;7.23
Rennes|France;48.11;-1.67
Cordes|France;44.07;1.95
Cordoue|Espagne;37.89;-4.77
Montargis|France;48.00;2.73
Martigues|France;43.41;5.06
Céret|France;42.49;2.75
Sitges|Espagne;41.24;1.81
Niigata|Japon;37.92;139.04
Saint-Bertrand-de-Comminges|France;43.03;0.57
Vizille|France;45.08;5.77
Champlitte|France;47.61;5.53
Venaria Reale|Italie;45.13;7.63
Bâle|Suisse;47.56;7.57
Honfleur|France;49.42;0.23
Dôle|France;47.09;5.49
Louviers|France;49.22;1.17
Izmir|Turquie;38.41;27.14
Nice|France;43.70;7.27
Manderen|France;49.45;6.44
Auxerre|France;47.80;3.57
Bruxelles|Belgique;50.85;4.35
Lourdes|France;43.09;-0.05
Liège|Belgique;50.63;5.57
Augsburg|Allemagne;48.37;10.90
Sens|France;48.20;3.28
Brescia|Italie;45.54;10.21
Angers|France;47.47;-0.55
Bologne|Italie;44.49;11.34
Blois|France;47.59;1.33
Valence|Espagne;39.47;-0.38
Seoul|Corée;37.57;126.98
Roques|France;43.50;1.37
Tournefeuille|France;43.59;1.32
Frankfurt|Allemagne;50.12;8.68
Florence|Italie;43.78;11.25
Hamamatsu|Japon;34.70;137.73
Castellón|Espagne;39.99;-0.05
Québec|Canada;46.81;-71.21
Aix-en-Provence|France;43.53;5.45
Oldenburg|Allemagne;53.14;8.21
Nîmes|France;43.84;4.36
Dazaifu|Japon;33.51;130.52
Pont-Aven|France;47.86;-3.75
Fukuoka|Japon;33.60;130.42
Agde|France;43.31;3.48
Nashville|Etats-Unis;36.17;-86.78
Arles|France;43.68;4.63
Ligornetto|Suisse;45.86;8.95
Chatou|France;48.89;2.16
Giverny|France;49.08;1.53
Ottawa|Canada;45.41;-75.70
Bourg-en-Bresse|France;46.21;5.23
Halle|Allemagne;51.48;11.98
Andorre|Andorre;42.51;1.52
Mannheim|Allemagne;49.49;8.47
Phoenix|Etats-Unis;33.45;-112.07
Le Havre|France;49.49;0.11
Malaga|Espagne;36.72;-4.42
Martigny|Suisse;46.10;7.07
Apeldoorn|Pays-Bas;52.21;5.97
Nogent-le-Rotrou|France;48.32;0.82
Saint-Claude|France;46.39;5.86
Fontainebleau|France;48.41;2.70
Toronto|Canada;43.71;-79.40
Alicante|Espagne;38.35;-0.48
Foix|France;42.97;1.61`

export const normLieu = (s: string) =>
  s.normalize('NFC').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim()

export const VILLES: Record<string, [number, number]> = Object.fromEntries(
  RAW.split('\n').map((l) => {
    const [k, lat, lon] = l.split(';')
    return [normLieu(k), [Number(lat), Number(lon)]]
  }),
)

export const TOULOUSE: [number, number] = [43.6043, 1.4437]

export function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
