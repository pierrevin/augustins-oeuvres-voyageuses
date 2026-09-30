import { useEffect, useState } from 'react'
import * as d3 from 'd3'
import type { Pret } from '../../lib/types.js'
import { useFiche } from './Fiches'
import { fmt } from '../util'

export interface PhotoMusee { titre: string; url: string; photo: string; langue: string }
let cache: Promise<Record<string, PhotoMusee>> | null = null
export function usePhotosMusees() {
  const [photos, setPhotos] = useState<Record<string, PhotoMusee>>({})
  useEffect(() => {
    cache ??= fetch('/api/musees').then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    cache.then(setPhotos)
  }, [])
  return photos
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

export function CarteMusee({ m, photo }: { m: Institution; photo?: PhotoMusee }) {
  const ouvrir = useFiche()
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
  const photos = usePhotosMusees()
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
        {liste.slice(0, n).map((m) => <CarteMusee key={m.cle} m={m} photo={photos[m.cle]} />)}
      </div>
      {n < liste.length && <button className="bouton centre" onClick={() => setN(n + 24)}>Voir plus d’institutions</button>}
      <p className="note">Photos : Wikipédia, rapprochées automatiquement par nom et ville. Chaque fiche renvoie vers l’article source pour vérifier.</p>
    </section>
  )
}
