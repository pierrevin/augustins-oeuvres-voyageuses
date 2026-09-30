// Fonction serverless Vercel : GET /api/musees
// Pour les institutions qui empruntent le plus, cherche un article Wikipédia et sa photo principale.
// Rapprochement automatique par nom et ville : chaque photo renvoie vers son article pour vérification.
import { construire } from '../lib/pipeline.js'

const UA = 'augustins-oeuvres-voyageuses/1.0 (https://github.com/pierrevin/augustins-oeuvres-voyageuses)'
const MAX = 90
const VIDES = new Set('musee museum museo museu museen musees des de la le les du d l art arts beaux national nationale nationales nazionale galerie galleria gallery galeries fondation foundation fundacion centre center centro the of and di del della y et fur kunst a en au aux sur city ville municipal departemental departementale'.split(' '))
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const mots = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((m) => m.length >= 3)

const erreurs: string[] = []
type Page = { title: string; index: number; fullurl: string; thumbnail?: { source: string } }

async function wiki(lang: string, q: string): Promise<Page[]> {
  const u = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=4&prop=pageimages|info&piprop=thumbnail&pithumbsize=480&inprop=url&redirects=1&gsrsearch=${encodeURIComponent(q)}`
  const r = await fetch(u, { headers: { 'user-agent': UA, 'api-user-agent': UA, accept: 'application/json' } })
  if (!r.ok) {
    erreurs.push(`${lang} ${r.status}`)
    return []
  }
  const j: any = await r.json()
  return Object.values(j?.query?.pages ?? {}).sort((a: any, b: any) => a.index - b.index) as Page[]
}

/** Score de ressemblance entre un titre d'article et une institution (0 = rejet). */
function score(page: Page, musee: string, ville: string) {
  const t = new Set(mots(page.title))
  const v = mots(ville)
  const distinctifs = [...new Set(mots(musee).filter((m) => !VIDES.has(m) && !v.includes(m)))]
  const communs = distinctifs.filter((m) => t.has(m))
  const villeOk = v.some((m) => t.has(m))
  if (distinctifs.length) {
    const ok = communs.length / distinctifs.length >= 0.5 || communs.some((m) => m.length >= 6)
    return ok ? communs.length * 2 + (villeOk ? 1 : 0) : 0
  }
  // Nom générique (« Musée des Beaux-Arts ») : la ville doit figurer dans le titre.
  return villeOk && /mus|galer|pinacot|kunst|museo|museum/.test(norm(page.title)) ? 1 : 0
}

/** Nom nettoyé pour la recherche : « Musée X/Ensemble Y » ou « A - B » ne garde que la première partie. */
const nomCourt = (m: string) => m.split(/\s*[/|]\s*|\s+-\s+/)[0]

async function chercher(musee: string, ville: string) {
  const nom = nomCourt(musee)
  for (const lang of ['fr', 'en']) {
    for (const q of [`${nom} ${ville}`, nom]) {
      try {
        const pages = (await wiki(lang, q)).filter((p) => p.thumbnail)
        const best = pages.map((p) => ({ p, s: score(p, nom, ville) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)[0]
        if (best) return { titre: best.p.title, url: best.p.fullurl, photo: best.p.thumbnail!.source, langue: lang }
      } catch {
        /* requête suivante */
      }
    }
  }
  return null
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>) {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]) } }))
  return out
}

export default async function handler(_req: any, res: any) {
  erreurs.length = 0
  try {
    const fetchJson = async (u: string) => (await fetch(u)).json()
    const data = await construire(fetchJson)
    const compte = new Map<string, number>()
    data.prets.forEach((p) => compte.set(p.musee + '|' + p.ville, (compte.get(p.musee + '|' + p.ville) ?? 0) + 1))
    const top = [...compte.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX).map(([k]) => k)
    const photos = await pool(top, 4, (k) => chercher(k.split('|')[0], k.split('|')[1]))
    const out: Record<string, unknown> = {}
    top.forEach((k, i) => photos[i] && (out[k] = photos[i]))
    // On ne met en cache que si la recherche a vraiment fonctionné.
    res.setHeader('Cache-Control', Object.keys(out).length > 10 ? 'public, s-maxage=604800, stale-while-revalidate=2592000' : 'no-store')
    res.setHeader('x-erreurs-wikipedia', String(erreurs.length))
    res.status(200).json(out)
  } catch (e: any) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ erreur: String(e?.message ?? e) })
  }
}

export const config = { maxDuration: 60 }
