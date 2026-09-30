import { useEffect, useState } from 'react'
import * as d3 from 'd3'
import type { Pret } from '../../lib/types.js'
import { useFiche } from './Fiches'
import { fmt } from '../util'

export interface PhotoMusee { titre: string; url: string; photo: string; langue: string }

// Photos des institutions : article Wikipédia rapproché automatiquement, directement depuis le navigateur
// (l'API de Wikipédia refuse les rafales venant d'un serveur). Résultats gardés en cache local.
const VIDES = new Set('musee museum museo museu museen musees des de la le les du d l art arts beaux national nationale nationales nazionale galerie galleria gallery galeries fondation foundation fundacion centre center centro the of and di del della y et fur kunst a en au aux sur city ville municipal departemental departementale'.split(' '))
const INTERDITS = /metro|station|cambriolage|\bvol\b|liste|incendie|affaire|\(film\)|attentat|\bgare\b/
const n = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const mots = (s: string) => n(s).split(/[^a-z0-9]+/).filter((m) => m.length >= 3)
const nomCourt = (m: string) => m.split(/\s*[/|]\s*|\s+-\s+/)[0]

function score(titre: string, musee: string, ville: string) {
  if (INTERDITS.test(n(titre))) return 0
  const t = new Set(mots(titre))
  const v = mots(ville)
  const distinctifs = [...new Set(mots(musee).filter((m) => !VIDES.has(m) && !v.includes(m)))]
  const communs = distinctifs.filter((m) => t.has(m))
  const villeOk = v.some((m) => t.has(m))
  const lieu = /mus|galer|pinacot|kunst|museo|museum|bibliot|chateau|palais|palazzo|abbaye|couvent|fondation|institut|centre|abattoirs|cathedr|eglise/.test(n(titre)) ? 1 : 0
  if (distinctifs.length) {
    const ok = communs.length / distinctifs.length >= 0.5 || communs.some((m) => m.length >= 6)
    return ok ? communs.length * 2 + (villeOk ? 1 : 0) + lieu : 0
  }
  return villeOk && /mus|galer|pinacot|kunst|museo|museum/.test(n(titre)) ? 1 : 0
}

async function wiki(lang: string, q: string) {
  const u = `https://${lang}.wikipedia.org/w/api.php?origin=*&action=query&format=json&generator=search&gsrlimit=4&prop=pageimages|info&piprop=thumbnail&pithumbsize=480&inprop=url&gsrsearch=${encodeURIComponent(q)}`
  const j = await fetch(u).then((r) => r.json())
  return (Object.values(j?.query?.pages ?? {}) as any[]).sort((a, b) => a.index - b.index)
}

async function chercherPhoto(cle: string): Promise<PhotoMusee | null> {
  const [m0, ville] = cle.split('|')
  const nom = nomCourt(m0)
  for (const lang of ['fr', 'en'])
    for (const q of [`${nom} ${ville}`, nom]) {
      try {
        const best = (await wiki(lang, q))
          .filter((p) => p.thumbnail)
          .map((p) => ({ p, s: score(p.title, nom, ville) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s || a.p.title.length - b.p.title.length)[0]
        if (best) return { titre: best.p.title, url: best.p.fullurl, photo: best.p.thumbnail.source, langue: lang }
      } catch (e) {
        throw e // erreur réseau : on ne mémorise rien, on réessaiera plus tard
      }
    }
  return null
}

const CLE_CACHE = 'augustins-photos-musees-v1'
const memoire = new Map<string, Promise<PhotoMusee | null>>()
let stock: Record<string, PhotoMusee | null> = {}
try { stock = JSON.parse(localStorage.getItem(CLE_CACHE) ?? '{}') } catch { stock = {} }
let actifs = 0
const file: (() => void)[] = []
const suivant = () => { actifs--; file.shift()?.() }
function photoDe(cle: string) {
  if (cle in stock) return Promise.resolve(stock[cle])
  if (!memoire.has(cle))
    memoire.set(cle, new Promise<PhotoMusee | null>((ok) => {
      const go = () => {
        actifs++
        chercherPhoto(cle).then((r) => {
          stock[cle] = r
          try { localStorage.setItem(CLE_CACHE, JSON.stringify(stock)) } catch { /* stockage indisponible */ }
          ok(r)
        }).catch(() => { memoire.delete(cle); ok(null) }).finally(suivant)
      }
      if (actifs < 3) go()
      else file.push(go)
    }))
  return memoire.get(cle)!
}

export function usePhotoMusee(cle: string) {
  const [photo, setPhoto] = useState<PhotoMusee | null | undefined>(stock[cle])
  useEffect(() => {
    let vivant = true
    photoDe(cle).then((p) => vivant && setPhoto(p))
    return () => { vivant = false }
  }, [cle])
  return photo
}

export interface Institution { cle: string; nom: string; ville: string; pays: string; prets: Pret[]; oeuvres: number; annees: [number, number]; nbAnnees: number }
export function institutions(prets: Pret[]): Institution[] {
  return d3
    .rollups(prets, (v) => v, (p) => p.musee + '|' + p.ville)
    .map(([cle, v]) => ({
      cle,
      nom: v[0].musee,
      ville: v[0].ville,
      pays: v[0].pays,
      prets: v,
      oeuvres: new Set(v.map((p) => p.oeuvreId)).size,
      annees: d3.extent(v, (p) => p.annee) as [number, number],
      nbAnnees: new Set(v.map((p) => p.annee)).size,
    }))
    .sort((a, b) => b.prets.length - a.prets.length)
}

export const initiales = (nom: string) =>
  nom.replace(/^(Musée|Museum|Museo|Galerie|Fondation|Les?|La|The)\s+(des?|du|de la|d’|of)?\s*/i, '').split(/[\s-]+/).filter((m) => m.length > 2).slice(0, 2).map((m) => m[0].toUpperCase()).join('') || '?'

export function CarteMusee({ m }: { m: Institution }) {
  const ouvrir = useFiche()
  const photo = usePhotoMusee(m.cle)
  const [ok, setOk] = useState(true)
  return (
    <button className="carte-musee" onClick={() => ouvrir({ type: 'musee', id: m.cle })}>
      {photo && ok ? <img src={photo.photo} alt="" loading="lazy" onError={() => setOk(false)} /> : <span className="musee-initiales" aria-hidden="true">{initiales(m.nom)}</span>}
      <span className="cm-texte">
        <strong>{m.nom}</strong>
        <small>{m.ville} ({m.pays})</small>
        <small className="cm-chiffres">{m.prets.length} prêt{m.prets.length > 1 ? 's' : ''} · {m.oeuvres} œuvre{m.oeuvres > 1 ? 's' : ''} · {m.annees[0] === m.annees[1] ? m.annees[0] : `${m.annees[0]}–${m.annees[1]}`}</small>
      </span>
    </button>
  )
}

export function BlocMusees({ prets, titre, sous, initial = 12 }: { prets: Pret[]; titre: string; sous: string; initial?: number }) {
  const [n, setN] = useState(initial)
  const [zone, setZone] = useState<'tout' | 'france' | 'etranger'>('tout')
  const liste = institutions(prets).filter((m) => zone === 'tout' || (zone === 'france' ? m.pays === 'France' : m.pays !== 'France'))
  return (
    <section className="bloc">
      <div className="bloc-tete">
        <h2>{titre} <small>({fmt(liste.length)})</small></h2>
        <div className="segment">
          {(['tout', 'france', 'etranger'] as const).map((z) => (
            <button key={z} className={zone === z ? 'on' : ''} onClick={() => { setZone(z); setN(initial) }}>{{ tout: 'Toutes', france: 'En France', etranger: 'À l’étranger' }[z]}</button>
          ))}
        </div>
      </div>
      <p className="sous">{sous}</p>
      <div className="grille-musees">
        {liste.slice(0, n).map((m) => <CarteMusee key={m.cle} m={m} />)}
      </div>
      {n < liste.length && <button className="bouton centre" onClick={() => setN(n + 24)}>Voir plus d’institutions</button>}
      <p className="note">Photos : Wikipédia, rapprochées automatiquement par nom et ville. Chaque fiche renvoie vers l’article source pour vérifier.</p>
    </section>
  )
}
