// Pipeline de données : API Open Data Toulouse Métropole -> JSON nettoyé, joint et audité.
// Aucune base de données : tout est recalculé à chaque expiration du cache.
import { CORRECTIONS_LIEUX, PAYS, VILLES, TOULOUSE, distanceKm, normLieu } from './geo.js'
import type { Artiste, BrutNet, Controle, Domaine, Oeuvre, Payload, Pret, Source } from './types.js'

export const API = 'https://data.toulouse-metropole.fr/api/explore/v2.1/catalog/datasets/'
export const DS = {
  prets: 'prets-des-collections-du-musee-des-augustins',
  inventaire: 'inventaire-collections-augustins',
  depots: 'inventaire-des-oeuvres-deposees-au-musee-des-augustins',
} as const

type Row = Record<string, any>
export type FetchJson = (url: string) => Promise<any>
export type CheckUrl = (url: string) => Promise<boolean | null> // null = non vérifiable

// ---------- normalisations ----------
const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
/** Clé de numéro d'inventaire : espaces insécables, espaces multiples, casse. */
export const cleInv = (s: string | null | undefined) =>
  (s ?? '').normalize('NFKC').replace(/[\s   ]+/g, ' ').trim().toUpperCase()
/** Clé « lâche » pour comparer des libellés : sans accents, casse, ponctuation. */
const cleTexte = (s: string | null | undefined) => sansAccents(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
/** Clé d'artiste insensible à l'ordre « Prénom Nom » / « NOM, Prénom ». */
const cleArtiste = (s: string | null | undefined) =>
  sansAccents(s ?? '').toLowerCase().replace(/\?/g, '').split(/[^a-z0-9]+/).filter(Boolean).sort().join(' ')
const propre = (s: any): string | null => {
  if (s === null || s === undefined) return null
  const t = String(s).replace(/[ ]/g, ' ').replace(/\s+/g, ' ').trim()
  return t === '' ? null : t
}
const plusFrequent = (vals: string[]) => {
  const c = new Map<string, number>()
  vals.forEach((v) => c.set(v, (c.get(v) ?? 0) + 1))
  return [...c.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? ''
}
const slug = (s: string) => cleArtiste(s).replace(/ /g, '-') || 'inconnu'
const jours = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

function domaineDe(d: string | null): Domaine {
  if (!d) return 'Autre ou inconnu'
  if (d === 'Peinture') return 'Peinture'
  if (d === 'Sculpture') return 'Sculpture'
  if (['Dessin', 'Arts graphiques', 'Gravure', 'Pastel'].includes(d)) return 'Arts graphiques'
  return 'Autre ou inconnu'
}
function siecleDe(datation: string | null): number | null {
  const m = (datation ?? '').match(/\d{3,4}/)
  if (!m) return null
  const y = Number(m[0])
  return Math.floor((y - 1) / 100) + 1
}
const variantes = (vals: (string | null)[], cle: (s: string) => string) => {
  const g = new Map<string, Set<string>>()
  vals.forEach((v) => {
    if (!v) return
    const k = cle(v)
    if (!g.has(k)) g.set(k, new Set())
    g.get(k)!.add(v)
  })
  return [...g.values()].filter((s) => s.size > 1).map((s) => [...s])
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++
        out[k] = await fn(items[k])
      }
    }),
  )
  return out
}

// ---------- pipeline ----------
export async function construire(fetchJson: FetchJson, checkUrl?: CheckUrl): Promise<Payload> {
  const [pretsBruts, inventaire, depots, ...metas] = (await Promise.all([
    fetchJson(API + DS.prets + '/exports/json'),
    fetchJson(API + DS.inventaire + '/exports/json'),
    fetchJson(API + DS.depots + '/exports/json'),
    fetchJson(API + DS.prets),
    fetchJson(API + DS.inventaire),
    fetchJson(API + DS.depots),
  ])) as [Row[], Row[], Row[], Row, Row, Row]

  // ----- sources -----
  const sources: Source[] = [
    [DS.prets, pretsBruts],
    [DS.inventaire, inventaire],
    [DS.depots, depots],
  ].map(([id, rows], i) => {
    const m = metas[i]?.metas?.default ?? {}
    const champs: string[] = (metas[i]?.fields ?? []).map((f: Row) => f.name)
    const r = rows as Row[]
    return {
      id: id as string,
      titre: m.title ?? (id as string),
      url: 'https://data.toulouse-metropole.fr/explore/dataset/' + id + '/',
      lignes: r.length,
      champs: champs.length,
      champsVides: champs.filter((c) => r.every((x) => propre(x[c]) === null)),
      modifie: m.modified ?? null,
      licence: m.license ?? null,
      producteur: m.publisher ?? null,
    }
  })
  const majPrets = sources[0].modifie?.slice(0, 10) ?? '9999-12-31'

  // ----- index inventaire + dépôts -----
  const invParCle = new Map<string, Row>()
  inventaire.forEach((x) => invParCle.set(cleInv(x.num_inventaire), x))
  const depParCle = new Map<string, Row>()
  depots.forEach((x) => depParCle.set(cleInv(x.numero_de_depot_inv), x))
  const invExact = new Set(inventaire.map((x) => x.num_inventaire))

  // ----- canonisation musées et artistes (prêts) -----
  const museeCanon = new Map<string, string>()
  {
    const g = new Map<string, string[]>()
    pretsBruts.forEach((p) => {
      const v = propre(p.musee)?.replace(/'/g, '’') ?? 'Non renseigné'
      const k = cleTexte(v)
      g.set(k, [...(g.get(k) ?? []), v])
    })
    g.forEach((vals, k) => museeCanon.set(k, plusFrequent(vals)))
  }
  const artisteCanon = new Map<string, string>()
  {
    const g = new Map<string, string[]>()
    pretsBruts.forEach((p) => {
      const v = propre(p.auteur) ?? 'Auteur non renseigné'
      const k = cleArtiste(v)
      g.set(k, [...(g.get(k) ?? []), v])
    })
    g.forEach((vals, k) => artisteCanon.set(k, plusFrequent(vals)))
  }

  // ----- images : vérification des URL du jeu de prêts -----
  const urls = [...new Set(pretsBruts.map((p) => propre(p.image)).filter(Boolean) as string[])]
  const etatUrl = new Map<string, { ok: boolean | null; url: string }>()
  if (checkUrl) {
    await pool(urls, 24, async (u) => {
      const a = await checkUrl(u)
      if (a) return etatUrl.set(u, { ok: true, url: u })
      if (a === null) return etatUrl.set(u, { ok: null, url: u })
      const alt = u.replace(/\.jpg$/, '.JPG')
      const b = alt !== u ? await checkUrl(alt) : false
      etatUrl.set(u, b ? { ok: true, url: alt } : { ok: b === null ? null : false, url: u })
    })
  }

  // ----- prêts -----
  const lieuxCorriges: string[] = []
  const nonGeo = new Set<string>()
  const prets: Pret[] = []
  const pretsParOeuvre = new Map<string, Row[]>()
  const oeuvreIdDe = (p: Row) => {
    const k = cleInv(p.ndeg_inventaire)
    return k ? 'inv-' + k.replace(/[^A-Z0-9]+/g, '-') : 'x-' + cleTexte(p.titre_de_l_oeuvre).slice(0, 40) + '-' + slug(p.auteur ?? '')
  }
  pretsBruts
    .slice()
    .sort((a, b) => String(a.date_de_debut).localeCompare(String(b.date_de_debut)))
    .forEach((p, i) => {
      const brut = normLieu(`${propre(p.ville) ?? ''}|${propre(p.pays) ?? ''}`)
      const corr = CORRECTIONS_LIEUX[brut] ?? CORRECTIONS_LIEUX[`${propre(p.ville)}|${propre(p.pays)}`]
      let [ville, pays] = brut.split('|')
      if (corr) {
        ville = corr.ville ?? ville
        pays = corr.pays ?? pays
        lieuxCorriges.push(brut)
      }
      const coord = VILLES[normLieu(`${ville}|${pays}`)] ?? null
      if (!coord) nonGeo.add(`${ville} (${pays})`)
      const debut = String(p.date_de_debut ?? '')
      const fin = String(p.date_de_fin ?? '')
      const inverse = !!debut && !!fin && fin < debut
      const oid = oeuvreIdDe(p)
      pretsParOeuvre.set(oid, [...(pretsParOeuvre.get(oid) ?? []), p])
      prets.push({
        id: i,
        oeuvreId: oid,
        expo: propre(p.titre_de_l_exposition) ?? 'Exposition non renseignée',
        musee: museeCanon.get(cleTexte(propre(p.musee)?.replace(/'/g, '’') ?? 'Non renseigné')) ?? 'Non renseigné',
        ville,
        pays,
        iso: PAYS[pays]?.iso ?? '',
        continent: PAYS[pays]?.continent ?? '',
        lat: coord?.[0] ?? null,
        lon: coord?.[1] ?? null,
        debut,
        fin,
        jours: inverse || !debut || !fin ? null : jours(debut, fin),
        annee: Number(debut.slice(0, 4)),
        km: coord ? Math.round(distanceKm(TOULOUSE, coord)) : null,
        datesInversees: inverse,
        programme: debut > majPrets,
      })
    })

  // ----- œuvres -----
  let recupereesInventaire = 0
  const oeuvres: Oeuvre[] = [...pretsParOeuvre.entries()].map(([id, rows]) => {
    const k = cleInv(rows[0].ndeg_inventaire)
    const inv = k ? invParCle.get(k) : undefined
    const dep = k && !inv ? depParCle.get(k) : undefined
    const titres = rows.map((r) => propre(r.titre_de_l_oeuvre) ?? 'Sans titre')
    const titre = plusFrequent(titres)
    const artiste = artisteCanon.get(cleArtiste(propre(rows[0].auteur) ?? 'Auteur non renseigné')) ?? 'Auteur non renseigné'
    const images: string[] = []
    const invImg = inv?.image?.url ?? dep?.image?.url
    const pretImgs = [...new Set(rows.map((r) => propre(r.image)).filter(Boolean) as string[])]
    const pretOk = pretImgs.map((u) => etatUrl.get(u)).filter((e) => e && e.ok !== false).map((e) => e!.url)
    const pretCasse = pretImgs.length > 0 && pretOk.length === 0 && checkUrl
    if (invImg) images.push(invImg)
    pretOk.forEach((u) => images.includes(u) || images.push(u))
    if (!checkUrl) pretImgs.forEach((u) => images.includes(u) || images.push(u))
    if (pretCasse && invImg) recupereesInventaire++
    const src = inv ?? dep
    const datation = propre(src?.datation_1)
    const dateAcq = propre(inv?.date_acqui ?? dep?.date_du_de)
    const pretsO = prets.filter((p) => p.oeuvreId === id)
    return {
      id,
      inv: propre(rows[0].ndeg_inventaire),
      titre,
      variantesTitre: [...new Map([...titres, ...(src ? [propre(src.designation ?? src.designation_1)].filter(Boolean) as string[] : [])]
        .filter((t) => cleTexte(t) !== cleTexte(titre))
        .map((t) => [cleTexte(t), t])).values()],
      artiste,
      artisteId: slug(artiste),
      domaine: domaineDe(propre(src?.domaine)),
      domaineBrut: propre(src?.domaine),
      designation: propre(src?.designation_2),
      datation,
      siecle: siecleDe(datation),
      technique: propre(src?.technique),
      matiere: propre(src?.matiere),
      mesures: [src?.mesure_1 ?? src?.mesures_1, src?.mesure_2 ?? src?.mesures_2, src?.mesure_3 ?? src?.mesures_3].map(propre).filter(Boolean).join(' · ') || null,
      acquisition: propre(inv?.mode_acquisition) ?? (dep ? 'Dépôt' : null),
      anneeAcquisition: dateAcq ? Number(dateAcq.slice(0, 4)) : null,
      proprietaire: propre(dep?.proprietaire),
      images,
      credit: propre(rows.find((r) => propre(r.credits))?.credits) ?? propre(inv?.credit_photo ?? dep?.copyright),
      source: inv ? 'inventaire' : dep ? 'depots' : 'absente',
      nbPrets: rows.length,
      joursHorsMurs: pretsO.reduce((s, p) => s + (p.jours ?? 0), 0),
      kmParcourus: pretsO.reduce((s, p) => s + 2 * (p.km ?? 0), 0),
      pays: [...new Set(pretsO.map((p) => p.pays))],
    }
  })

  // ----- artistes -----
  const invParArtiste = new Map<string, number>()
  inventaire.forEach((x) => {
    const k = cleArtiste(x.auteur_1)
    invParArtiste.set(k, (invParArtiste.get(k) ?? 0) + 1)
  })
  const artistesMap = new Map<string, Artiste>()
  oeuvres.forEach((o) => {
    const a = artistesMap.get(o.artisteId) ?? {
      id: o.artisteId,
      nom: o.artiste,
      variantes: [],
      nbPrets: 0,
      oeuvres: [],
      nbOeuvresCollection: invParArtiste.get(cleArtiste(o.artiste)) ?? 0,
      pays: [],
    }
    a.nbPrets += o.nbPrets
    a.oeuvres.push(o.id)
    a.pays = [...new Set([...a.pays, ...o.pays])]
    artistesMap.set(o.artisteId, a)
  })
  artisteCanonVariantes(pretsBruts).forEach((vs) => {
    const a = artistesMap.get(slug(vs[0]))
    if (a) a.variantes = vs.filter((v) => v !== a.nom)
  })
  const artistes = [...artistesMap.values()].sort((a, b) => b.nbPrets - a.nbPrets)

  // ----- collection -----
  const pretesParDomaine = new Map<Domaine, number>()
  oeuvres.filter((o) => o.source === 'inventaire').forEach((o) => pretesParDomaine.set(o.domaine, (pretesParDomaine.get(o.domaine) ?? 0) + 1))
  const totalParDomaine = new Map<Domaine, number>()
  inventaire.forEach((x) => totalParDomaine.set(domaineDe(propre(x.domaine)), (totalParDomaine.get(domaineDe(propre(x.domaine))) ?? 0) + 1))

  // ----- audit qualité -----
  const controles: Controle[] = []
  const N = pretsBruts.length
  const ajoute = (c: Controle) => c.nb > 0 && controles.push(c)
  const ex = (a: string[], n = 6) => a.slice(0, n)

  const inversees = pretsBruts.filter((p) => p.date_de_fin && p.date_de_debut && p.date_de_fin < p.date_de_debut)
  ajoute({
    id: 'dates-inversees', jeu: 'Prêts', titre: 'Date de fin avant la date de début', nb: inversees.length, total: N, gravite: 'bloquant',
    constat: 'Une durée négative fausse tous les cumuls. C’est ce qui produisait un total de jours négatif dans l’ancien tableau de bord.',
    regle: 'Prêt conservé dans les décomptes, mais exclu des calculs de durée.',
    exemples: ex(inversees.map((p) => `${p.titre_de_l_oeuvre} : du ${p.date_de_debut} au ${p.date_de_fin}`)),
  })
  const invBruts = pretsBruts.map((p) => p.ndeg_inventaire).filter(Boolean) as string[]
  const insec = pretsBruts.filter((p) => /[   ]/.test(p.ndeg_inventaire ?? ''))
  const distinctBrut = new Set(invBruts).size
  const distinctNet = new Set(invBruts.map(cleInv)).size
  ajoute({
    id: 'espaces-invisibles', jeu: 'Prêts', titre: 'Espaces insécables invisibles dans les numéros d’inventaire', nb: insec.length, total: N, gravite: 'bloquant',
    constat: `Deux numéros identiques à l’écran sont différents pour la machine. Sans nettoyage, on compte ${distinctBrut} œuvres distinctes au lieu de ${distinctNet}, et la jointure avec l’inventaire échoue.`,
    regle: 'Remplacement des espaces spéciaux par des espaces simples, suppression des espaces multiples, passage en majuscules.',
    exemples: ex(insec.map((p) => `« ${String(p.ndeg_inventaire).replace(/[   ]/g, '⍽')} » (⍽ = espace insécable)`)),
  })
  const sansInv = pretsBruts.filter((p) => !propre(p.ndeg_inventaire))
  ajoute({
    id: 'sans-inventaire', jeu: 'Prêts', titre: 'Prêts sans numéro d’inventaire', nb: sansInv.length, total: N, gravite: 'important',
    constat: 'Sans numéro, impossible de relier le prêt à la fiche de l’œuvre. Pour certains, le champ « exposition » contient un nom de personne plutôt qu’un titre.',
    regle: 'Œuvre identifiée par son titre et son auteur. Aucune donnée d’inventaire associée.',
    exemples: ex(sansInv.map((p) => `${p.titre_de_l_oeuvre} (${p.auteur}), exposition : « ${p.titre_de_l_exposition} »`)),
  })
  const titresParInv = new Map<string, Set<string>>()
  pretsBruts.forEach((p) => {
    const k = cleInv(p.ndeg_inventaire)
    if (!k) return
    if (!titresParInv.has(k)) titresParInv.set(k, new Set())
    titresParInv.get(k)!.add(propre(p.titre_de_l_oeuvre) ?? '')
  })
  const multiTitres = [...titresParInv.entries()].filter(([, s]) => new Set([...s].map(cleTexte)).size > 1)
  ajoute({
    id: 'titres-multiples', jeu: 'Prêts', titre: 'Un même numéro d’inventaire, plusieurs titres', nb: multiTitres.length, total: distinctNet, gravite: 'important',
    constat: 'Souvent une simple variante (orthographe, ordre des mots). Parfois deux objets différents sous le même numéro : une paire d’œuvres, ou une erreur de saisie ? Seul le musée peut trancher.',
    regle: 'Le titre le plus fréquent est affiché, les autres sont conservés comme variantes sur la fiche.',
    exemples: ex(multiTitres.map(([k, s]) => `${k} : ${[...s].join(' / ')}`)),
  })
  const varMusees = variantes(pretsBruts.map((p) => propre(p.musee)), (s) => cleTexte(s.replace(/'/g, '’')))
  ajoute({
    id: 'musees', jeu: 'Prêts', titre: 'Institutions écrites de plusieurs façons', nb: varMusees.length, total: new Set(pretsBruts.map((p) => p.musee)).size, gravite: 'mineur',
    constat: 'Majuscules, apostrophes droites ou courbes : une même institution apparaît sous plusieurs noms et fausse le classement des emprunteurs.',
    regle: 'Regroupement sur une clé sans accents, casse ni ponctuation. La graphie la plus fréquente est retenue.',
    exemples: ex(varMusees.map((v) => v.join(' / '))),
  })
  const varArtistes = artisteCanonVariantes(pretsBruts)
  ajoute({
    id: 'artistes', jeu: 'Prêts', titre: 'Artistes écrits de plusieurs façons', nb: varArtistes.length, total: artisteCanon.size, gravite: 'mineur',
    constat: 'Trait d’union présent ou absent dans les prénoms composés : l’artiste est compté deux fois.',
    regle: 'Regroupement sur une clé sans accents ni ponctuation. La graphie la plus fréquente est retenue.',
    exemples: ex(varArtistes.map((v) => v.join(' / '))),
  })
  const lieuxUniques = [...new Set(lieuxCorriges)]
  ajoute({
    id: 'lieux', jeu: 'Prêts', titre: 'Villes mal orthographiées ou rangées dans le mauvais pays', nb: lieuxCorriges.length, total: N, gravite: 'important',
    constat: `${lieuxUniques.length} couples ville/pays erronés. Révélés au moment du géocodage : Hambourg n’est pas en France, ni Toronto aux États-Unis.`,
    regle: 'Table de correction manuelle, documentée et versionnée avec le code.',
    exemples: ex(lieuxUniques.map((l) => `${l.replace('|', ' / ')} → ${CORRECTIONS_LIEUX[l]?.motif ?? ''}`), 15),
  })
  const aposDroite = pretsBruts.filter((p) => /'/.test(p.titre_de_l_oeuvre ?? '')).length
  const aposCourbe = pretsBruts.filter((p) => /’/.test(p.titre_de_l_oeuvre ?? '')).length
  ajoute({
    id: 'apostrophes', jeu: 'Prêts', titre: 'Apostrophes droites et courbes mélangées', nb: Math.min(aposDroite, aposCourbe), total: aposDroite + aposCourbe, gravite: 'mineur',
    constat: `${aposCourbe} titres utilisent l’apostrophe courbe (’), ${aposDroite} l’apostrophe droite ('). Une recherche sur « L’Éruption » ne trouve pas « L'Eruption ».`,
    regle: 'Comparaisons faites sur une clé qui ignore la ponctuation. Affichage inchangé.',
    exemples: [],
  })
  const dup = new Map<string, Row[]>()
  pretsBruts.forEach((p) => {
    const k = cleInv(p.ndeg_inventaire)
    if (!k) return
    const kk = k + '|' + p.date_de_debut + '|' + cleTexte(p.musee)
    dup.set(kk, [...(dup.get(kk) ?? []), p])
  })
  const doublons = [...dup.values()].filter((a) => a.length > 1)
  ajoute({
    id: 'doublons', jeu: 'Prêts', titre: 'Même œuvre, même musée, même date, plusieurs lignes', nb: doublons.length, total: N, gravite: 'important',
    constat: 'Deux lignes pour un même numéro d’inventaire, prêté le même jour au même musée. Doublon ou paire d’œuvres enregistrée sous un seul numéro ?',
    regle: 'Lignes conservées (pas de suppression sans validation du musée), signalées ici.',
    exemples: ex(doublons.map((a) => `${a[0].ndeg_inventaire} : ${a.map((p) => p.titre_de_l_oeuvre).join(' / ')} (${a[0].date_de_debut})`)),
  })
  const programmes = prets.filter((p) => p.programme)
  ajoute({
    id: 'programmes', jeu: 'Prêts', titre: 'Prêts postérieurs à la dernière mise à jour du jeu', nb: programmes.length, total: N, gravite: 'info',
    constat: `Ces prêts commencent après le ${majPrets}, date de mise à jour du jeu. Ce sont des prêts programmés : ont-ils vraiment eu lieu ?`,
    regle: 'Conservés, marqués « programmés » dans le tableau de bord.',
    exemples: ex(programmes.map((p) => `${p.debut} : ${p.expo} (${p.ville})`)),
  })
  const longs = prets.filter((p) => (p.jours ?? 0) > 365)
  ajoute({
    id: 'longs', jeu: 'Prêts', titre: 'Prêts de plus d’un an', nb: longs.length, total: N, gravite: 'info',
    constat: 'Pas forcément une erreur (expositions longues, dépôts), mais à vérifier : ils pèsent lourd dans les cumuls de jours.',
    regle: 'Conservés tels quels.',
    exemples: ex(longs.map((p) => `${oeuvres.find((o) => o.id === p.oeuvreId)?.titre} : ${p.jours} jours (${p.ville})`)),
  })
  const sansImg = pretsBruts.filter((p) => !propre(p.image))
  const nbOk = [...etatUrl.values()].filter((e) => e.ok === true).length
  const repareesCasse = [...etatUrl.entries()].filter(([u, e]) => e.ok && e.url !== u).length
  const cassees = [...etatUrl.values()].filter((e) => e.ok === false).length
  const nonVerifiees = checkUrl ? [...etatUrl.values()].filter((e) => e.ok === null).length : urls.length
  ajoute({
    id: 'images', jeu: 'Prêts', titre: 'Liens d’images cassés', nb: cassees + repareesCasse, total: urls.length, gravite: 'important',
    constat: `Sur ${urls.length} images référencées, ${repareesCasse} ne s’affichent qu’en changeant l’extension .jpg en .JPG (le serveur distingue les majuscules), et ${cassees} restent introuvables. ${sansImg.length} prêts n’ont aucune image.`,
    regle: `Chaîne de repli : image de l’inventaire, puis lien du prêt, puis variante .JPG. ${recupereesInventaire} œuvres aux liens cassés récupèrent ainsi une image via l’inventaire.`,
    exemples: ex([...etatUrl.entries()].filter(([, e]) => e.ok === false).map(([u]) => u.split('/').pop()!)),
  })
  const sansCredit = pretsBruts.filter((p) => !propre(p.credits))
  ajoute({
    id: 'credits', jeu: 'Prêts', titre: 'Crédits photo manquants', nb: sansCredit.length, total: N, gravite: 'mineur',
    constat: 'Une image publiée sans crédit pose un problème de droits et de citation.',
    regle: 'Crédit repris de l’inventaire quand il existe.',
    exemples: [],
  })

  // Inventaire
  const NI = inventaire.length
  const dates = inventaire.map((x) => propre(x.date_acqui)).filter(Boolean) as string[]
  const janv = dates.filter((d) => d.slice(5, 10) === '01-01')
  ajoute({
    id: 'premier-janvier', jeu: 'Inventaire', titre: 'Dates d’acquisition au 1er janvier', nb: janv.length, total: dates.length, gravite: 'important',
    constat: `${Math.round((100 * janv.length) / dates.length)} % des dates tombent un 1er janvier. Hypothèse la plus probable : seule l’année est connue, stockée comme une date complète. Une fausse précision.`,
    regle: 'Seule l’année d’acquisition est utilisée.',
    exemples: ex(janv.slice(0, 4)),
  })
  const formats = new Map<string, number>()
  inventaire.forEach((x) => {
    const f = (propre(x.datation_1) ?? '(vide)').replace(/\d/g, '9')
    formats.set(f, (formats.get(f) ?? 0) + 1)
  })
  ajoute({
    id: 'datation', jeu: 'Inventaire', titre: 'Datation en texte libre', nb: formats.size, total: 0, unite: 'formats différents', gravite: 'important',
    constat: `${formats.size} formats différents pour dater une œuvre (siècle, année, « vers », « avant », « entre », points d’interrogation…). Impossible de trier ou filtrer par date sans les interpréter.`,
    regle: 'Extraction du premier millésime pour en déduire un siècle approximatif.',
    exemples: [...formats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, n]) => `« ${f} » : ${n} fois`),
  })
  const prix = inventaire.map((x) => propre(x.prix_achat)).filter(Boolean) as string[]
  const frf = prix.filter((p) => /FRF|F$/.test(p)).length
  ajoute({
    id: 'prix', jeu: 'Inventaire', titre: 'Prix d’achat en euros et en francs, stockés comme du texte', nb: frf, total: prix.length, gravite: 'mineur',
    constat: `${prix.length} prix renseignés, dont ${frf} en francs et ${prix.length - frf} en euros, dans un champ texte. Une somme directe n’a aucun sens.`,
    regle: 'Champ non exploité dans les visualisations.',
    exemples: ex(prix, 5),
  })
  const vides = sources[1].champsVides
  ajoute({
    id: 'colonnes-vides', jeu: 'Inventaire', titre: 'Colonnes entièrement vides', nb: vides.length, total: sources[1].champs, gravite: 'info',
    constat: 'Colonnes prévues par la norme de l’inventaire réglementaire, jamais remplies à l’export.',
    regle: 'Ignorées.',
    exemples: vides,
  })
  const modeInconnu = inventaire.filter((x) => !propre(x.mode_acquisition) || /inconnu/i.test(x.mode_acquisition)).length
  ajoute({
    id: 'mode-acquisition', jeu: 'Inventaire', titre: 'Mode d’acquisition inconnu ou vide', nb: modeInconnu, total: NI, gravite: 'info',
    constat: 'Pour une partie du fonds, l’historique d’entrée au musée n’est pas documenté.',
    regle: 'Affiché « non renseigné » sur les fiches.',
    exemples: [],
  })
  const doute = inventaire.filter((x) => /\?/.test(x.auteur_1 ?? ''))
  ajoute({
    id: 'attribution', jeu: 'Inventaire', titre: 'Incertitude codée dans le nom de l’auteur', nb: doute.length, total: NI, gravite: 'mineur',
    constat: 'Le point d’interrogation (« Anonyme français ? ») mélange la donnée et son degré de certitude dans un même champ.',
    regle: 'Point d’interrogation ignoré pour les regroupements, conservé à l’affichage.',
    exemples: ex([...new Set(doute.map((x) => x.auteur_1 as string))]),
  })
  const mesures = inventaire.filter((x) => propre(x.mesure_1))
  ajoute({
    id: 'mesures', jeu: 'Inventaire', titre: 'Dimensions stockées en texte', nb: mesures.length, total: NI, gravite: 'info',
    constat: 'Libellé et valeur dans le même champ (« Hauteur : 69 »), unité implicite. Il faut découper le texte pour calculer quoi que ce soit.',
    regle: 'Affichées telles quelles sur les fiches.',
    exemples: ex([...new Set(mesures.map((x) => x.mesure_1 as string))], 4),
  })

  // Croisement
  const clesPret = [...new Set(pretsBruts.map((p) => cleInv(p.ndeg_inventaire)).filter(Boolean))]
  const exactOk = new Set(pretsBruts.filter((p) => p.ndeg_inventaire && invExact.has(p.ndeg_inventaire)).map((p) => cleInv(p.ndeg_inventaire))).size
  const netInv = clesPret.filter((k) => invParCle.has(k)).length
  const netDep = clesPret.filter((k) => !invParCle.has(k) && depParCle.has(k)).length
  const orphelins = clesPret.filter((k) => !invParCle.has(k) && !depParCle.has(k))
  ajoute({
    id: 'appariement', jeu: 'Croisement', titre: 'Œuvres prêtées introuvables dans l’inventaire', nb: orphelins.length, total: clesPret.length, gravite: 'important',
    constat: `En comparant les numéros tels quels, seules ${exactOk} œuvres sur ${clesPret.length} sont retrouvées (« Ro 34 » contre « RO 34 »). Après normalisation : ${netInv} dans l’inventaire, ${netDep} de plus dans le registre des dépôts. Restent ${orphelins.length} numéros sans fiche.`,
    regle: 'Jointure sur le numéro normalisé, d’abord dans l’inventaire puis dans les dépôts.',
    exemples: ex(orphelins, 10),
  })
  const paires = pretsBruts.map((p) => [p, invParCle.get(cleInv(p.ndeg_inventaire))] as const).filter(([, i]) => i)
  const auteurDiffTexte = paires.filter(([p, i]) => cleTexte(p.auteur) !== cleTexte(i!.auteur_1))
  const auteurDiffNorm = paires.filter(([p, i]) => cleArtiste(p.auteur) !== cleArtiste(i!.auteur_1))
  ajoute({
    id: 'auteurs-croises', jeu: 'Croisement', titre: 'L’auteur n’est pas écrit de la même façon dans les deux jeux', nb: auteurDiffTexte.length, total: paires.length, gravite: 'important',
    constat: `« Jean Béraud » dans les prêts, « BERAUD, Jean » dans l’inventaire. En remettant les mots dans l’ordre, il reste ${auteurDiffNorm.length} désaccords réels (prénoms complets, attributions différentes).`,
    regle: 'Jointure uniquement sur le numéro d’inventaire. L’auteur affiché est celui du jeu de prêts.',
    exemples: ex([...new Set(auteurDiffNorm.map(([p, i]) => `${p.auteur} ≠ ${i!.auteur_1}`))]),
  })
  const titreDiff = paires.filter(([p, i]) => cleTexte(p.titre_de_l_oeuvre) !== cleTexte(i!.designation))
  ajoute({
    id: 'titres-croises', jeu: 'Croisement', titre: 'Titre différent entre prêts et inventaire', nb: titreDiff.length, total: paires.length, gravite: 'mineur',
    constat: 'Le jeu de prêts donne souvent un titre d’usage, l’inventaire un intitulé réglementaire.',
    regle: 'Titre du jeu de prêts affiché, intitulé de l’inventaire en variante.',
    exemples: ex([...new Set(titreDiff.map(([p, i]) => `${p.titre_de_l_oeuvre} ≠ ${i!.designation}`))]),
  })
  if (nonGeo.size)
    ajoute({
      id: 'geocodage', jeu: 'Prêts', titre: 'Villes non géocodées', nb: nonGeo.size, total: new Set(prets.map((p) => p.ville + p.pays)).size, gravite: 'important',
      constat: 'Villes apparues depuis la dernière mise à jour du référentiel : elles n’apparaissent pas sur la carte.',
      regle: 'À ajouter dans lib/geo.ts.',
      exemples: [...nonGeo],
    })

  const ordre = { bloquant: 0, important: 1, mineur: 2, info: 3 }
  controles.sort((a, b) => ordre[a.gravite] - ordre[b.gravite])

  // ----- brut vs net -----
  const sommeBrute = pretsBruts.reduce((s, p) => s + (p.date_de_debut && p.date_de_fin ? jours(p.date_de_debut, p.date_de_fin) : 0), 0)
  const brutVsNet: BrutNet[] = [
    { indicateur: 'Œuvres distinctes', brut: distinctBrut, net: distinctNet, commentaire: 'Les espaces invisibles dédoublent des œuvres.' },
    { indicateur: 'Institutions emprunteuses', brut: new Set(pretsBruts.map((p) => p.musee + '|' + p.ville)).size, net: new Set(prets.map((p) => p.musee + '|' + p.ville)).size, commentaire: 'Majuscules et apostrophes créent des doublons. Une institution = un nom dans une ville (il y a des « Musée des Beaux-Arts » partout).' },
    { indicateur: 'Artistes', brut: new Set(pretsBruts.map((p) => p.auteur)).size, net: artistes.length, commentaire: 'Traits d’union, espaces en trop, attribution qui varie d’un prêt à l’autre pour une même œuvre.' },
    { indicateur: 'Pays', brut: new Set(pretsBruts.map((p) => p.pays)).size, net: new Set(prets.map((p) => p.pays)).size, commentaire: 'Le nombre ne bouge pas, mais des prêts changent de pays.' },
    { indicateur: 'Prêts hors de France', brut: pretsBruts.filter((p) => p.pays !== 'France').length, net: prets.filter((p) => p.pays !== 'France').length, commentaire: 'Hambourg, Montréal, Pérouse, Pavie, Berne étaient rangées en France.' },
    { indicateur: 'Jours hors les murs (cumul)', brut: sommeBrute, net: prets.reduce((s, p) => s + (p.jours ?? 0), 0), commentaire: 'Les dates inversées retranchent des jours.' },
    { indicateur: 'Œuvres reliées à une fiche', brut: exactOk, net: netInv + netDep, commentaire: 'Normalisation des numéros, puis ajout du registre des dépôts.' },
    { indicateur: 'Œuvres avec image affichable', brut: oeuvres.filter((o) => pretsParOeuvre.get(o.id)!.some((r) => propre(r.image))).length, net: oeuvres.filter((o) => o.images.length > 0).length, commentaire: checkUrl ? 'Brut : un lien existe, sans garantie qu’il fonctionne. Net : image vérifiée.' : 'Liens non vérifiés.' },
  ]

  return {
    genereLe: new Date().toISOString(),
    sources,
    oeuvres: oeuvres.sort((a, b) => b.nbPrets - a.nbPrets),
    prets,
    artistes,
    collection: {
      domaines: (['Peinture', 'Sculpture', 'Arts graphiques', 'Autre ou inconnu'] as Domaine[]).map((d) => ({ domaine: d, total: totalParDomaine.get(d) ?? 0, pretees: pretesParDomaine.get(d) ?? 0 })),
      totalInventaire: NI,
      totalDepots: depots.length,
      inventaireAvecImage: inventaire.filter((x) => x.image).length,
    },
    images: { urls: urls.length, ok: nbOk - repareesCasse, repareesCasse, cassees, nonVerifiees, recupereesInventaire },
    controles,
    brutVsNet,
    villesNonGeocodees: [...nonGeo],
  }
}

function artisteCanonVariantes(pretsBruts: Row[]) {
  return variantes(pretsBruts.map((p) => propre(p.auteur)), cleArtiste)
}
