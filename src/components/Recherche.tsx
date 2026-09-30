import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { Oeuvre, Pret } from '../../lib/types.js'
import type { Index } from '../util'

export type TypeFiltre = 'oeuvre' | 'artiste' | 'ville' | 'pays' | 'institution' | 'expo' | 'texte'
export interface Filtre { type: TypeFiltre; valeur: string; label: string }

export const TYPES: Record<TypeFiltre, string> = {
  oeuvre: 'Œuvre',
  artiste: 'Artiste',
  ville: 'Ville',
  pays: 'Pays',
  institution: 'Institution',
  expo: 'Exposition',
  texte: 'Texte',
}
const ORDRE: TypeFiltre[] = ['oeuvre', 'artiste', 'ville', 'pays', 'institution', 'expo']

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'")

interface Entree { type: TypeFiltre; valeur: string; label: string; sous: string; cle: string; poids: number }

/** Index des suggestions : construit une fois à partir des données. */
export function useEntrees(idx: Index) {
  return useMemo(() => {
    const e: Entree[] = []
    const { data } = idx
    data.oeuvres.forEach((o) => e.push({ type: 'oeuvre', valeur: o.id, label: o.titre, sous: `${o.artiste}${o.inv ? ' · ' + o.inv : ''}`, cle: norm(`${o.titre} ${o.variantesTitre.join(' ')} ${o.inv ?? ''}`), poids: o.nbPrets }))
    data.artistes.forEach((a) => e.push({ type: 'artiste', valeur: a.id, label: a.nom, sous: `${a.nbPrets} prêt${a.nbPrets > 1 ? 's' : ''}`, cle: norm(`${a.nom} ${a.variantes.join(' ')}`), poids: a.nbPrets }))
    const compte = (f: (p: Pret) => string) => {
      const m = new Map<string, Pret[]>()
      data.prets.forEach((p) => m.set(f(p), [...(m.get(f(p)) ?? []), p]))
      return m
    }
    compte((p) => p.ville + '|' + p.pays).forEach((v, k) => e.push({ type: 'ville', valeur: k, label: v[0].ville, sous: `${v[0].pays} · ${v.length} prêt${v.length > 1 ? 's' : ''}`, cle: norm(v[0].ville), poids: v.length }))
    compte((p) => p.pays).forEach((v, k) => e.push({ type: 'pays', valeur: k, label: k, sous: `${v.length} prêt${v.length > 1 ? 's' : ''}`, cle: norm(k), poids: v.length }))
    compte((p) => p.musee + '|' + p.ville).forEach((v, k) => e.push({ type: 'institution', valeur: k, label: v[0].musee, sous: `${v[0].ville} · ${v.length} prêt${v.length > 1 ? 's' : ''}`, cle: norm(`${v[0].musee} ${v[0].ville}`), poids: v.length }))
    compte((p) => p.expo).forEach((v, k) => e.push({ type: 'expo', valeur: k, label: k, sous: `${v[0].musee}, ${v[0].ville} · ${v[0].debut.slice(0, 4)}`, cle: norm(`${k} ${v[0].musee}`), poids: v.length }))
    return e
  }, [idx])
}

function chercher(entrees: Entree[], q: string, types: TypeFiltre[]) {
  const mots = norm(q).split(/\s+/).filter(Boolean)
  if (!mots.length) return []
  const res: (Entree & { score: number })[] = []
  entrees.forEach((e) => {
    if (!types.includes(e.type)) return
    if (!mots.every((m) => e.cle.includes(m))) return
    const debut = e.cle.startsWith(mots[0]) ? 3 : new RegExp('(^|[^a-z0-9])' + mots[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(e.cle) ? 2 : 1
    res.push({ ...e, score: debut * 1000 + e.poids })
  })
  const parType = ORDRE.filter((t) => types.includes(t)).map((t) => ({ type: t, items: res.filter((r) => r.type === t).sort((a, b) => b.score - a.score).slice(0, t === 'oeuvre' ? 5 : 4) }))
  return parType.filter((g) => g.items.length)
}

function surligner(texte: string, q: string): ReactNode {
  const mot = norm(q).split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length)[0]
  if (!mot) return texte
  const n = norm(texte)
  if (n.length !== texte.length) return texte
  const i = n.indexOf(mot)
  if (i < 0) return texte
  return <>{texte.slice(0, i)}<mark>{texte.slice(i, i + mot.length)}</mark>{texte.slice(i + mot.length)}</>
}

/** Recherche « à la moderne » : suggestions classées par type en temps réel, filtres en pastilles. */
export function Recherche({
  idx,
  filtres,
  setFiltres,
  types = ORDRE,
  placeholder = 'Rechercher une œuvre, un artiste, une ville, un musée…',
  onOeuvre,
}: {
  idx: Index
  filtres: Filtre[]
  setFiltres: (f: Filtre[]) => void
  types?: TypeFiltre[]
  placeholder?: string
  onOeuvre?: (id: string) => void
}) {
  const entrees = useEntrees(idx)
  const [q, setQ] = useState('')
  const [ouvert, setOuvert] = useState(false)
  const [actif, setActif] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const groupes = useMemo(() => chercher(entrees, q, types), [entrees, q, types])
  const plat = groupes.flatMap((g) => g.items)

  const ajouter = (f: Filtre) => {
    if (f.type === 'oeuvre' && onOeuvre) onOeuvre(f.valeur)
    else if (!filtres.some((x) => x.type === f.type && x.valeur === f.valeur)) setFiltres([...filtres, f])
    setQ('')
    setActif(0)
    input.current?.focus()
  }
  const choisir = (e: Entree) => ajouter({ type: e.type, valeur: e.valeur, label: e.label })
  const clavier = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setOuvert(true); setActif((a) => Math.min(a + 1, plat.length)) }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActif((a) => Math.max(a - 1, 0)) }
    else if (ev.key === 'Enter') {
      ev.preventDefault()
      if (actif > 0 && plat[actif - 1]) choisir(plat[actif - 1])
      else if (q.trim()) ajouter({ type: 'texte', valeur: q.trim(), label: q.trim() })
    } else if (ev.key === 'Escape') setOuvert(false)
    else if (ev.key === 'Backspace' && !q && filtres.length) setFiltres(filtres.slice(0, -1))
  }
  let n = 0
  return (
    <div className="recherche" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOuvert(false)}>
      <div className="recherche-champ" onClick={() => input.current?.focus()}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M13 13l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        {filtres.map((f, i) => (
          <span key={f.type + f.valeur} className={'pastille-filtre t-' + f.type}>
            <small>{TYPES[f.type]}</small>{f.label}
            <button onClick={(e) => { e.stopPropagation(); setFiltres(filtres.filter((_, j) => j !== i)) }} aria-label={`Retirer le filtre ${f.label}`}>×</button>
          </span>
        ))}
        <input
          ref={input}
          type="search"
          value={q}
          placeholder={filtres.length ? 'Ajouter un critère…' : placeholder}
          onChange={(e) => { setQ(e.target.value); setOuvert(true); setActif(0) }}
          onFocus={() => setOuvert(true)}
          onKeyDown={clavier}
          aria-autocomplete="list"
          aria-expanded={ouvert && !!q}
          role="combobox"
        />
      </div>
      {ouvert && q.trim() && (
        <div className="suggestions" role="listbox">
          {groupes.length === 0 && <p className="sugg-vide">Aucune correspondance. Entrée pour chercher « {q} » dans tout le texte.</p>}
          {groupes.map((g) => (
            <div key={g.type} className="sugg-groupe">
              <p className="sugg-type">{TYPES[g.type]}s</p>
              {g.items.map((e) => {
                n++
                const k = n
                return (
                  <button key={e.type + e.valeur} role="option" aria-selected={actif === k} className={'sugg' + (actif === k ? ' actif' : '')} onMouseEnter={() => setActif(k)} onMouseDown={(ev) => ev.preventDefault()} onClick={() => choisir(e)}>
                    <span className="sugg-l">{surligner(e.label, q)}</span>
                    <span className="sugg-s">{e.sous}</span>
                  </button>
                )
              })}
            </div>
          ))}
          {groupes.length > 0 && <p className="sugg-pied">↑ ↓ pour naviguer, Entrée pour choisir. Entrée sans sélection : recherche libre.</p>}
        </div>
      )}
    </div>
  )
}

/** Un prêt correspond-il aux filtres ? ET entre types différents, OU à l'intérieur d'un même type. */
export function correspond(filtres: Filtre[], p: Pret, o: Oeuvre) {
  const parType = new Map<TypeFiltre, Filtre[]>()
  filtres.forEach((f) => parType.set(f.type, [...(parType.get(f.type) ?? []), f]))
  for (const [t, fs] of parType) {
    const ok = fs.some((f) => {
      switch (t) {
        case 'oeuvre': return p.oeuvreId === f.valeur
        case 'artiste': return o.artisteId === f.valeur
        case 'ville': return p.ville + '|' + p.pays === f.valeur
        case 'pays': return p.pays === f.valeur
        case 'institution': return p.musee + '|' + p.ville === f.valeur
        case 'expo': return p.expo === f.valeur
        case 'texte': {
          const txt = norm(`${o.titre} ${o.artiste} ${o.inv ?? ''} ${p.expo} ${p.musee} ${p.ville} ${p.pays}`)
          return norm(f.valeur).split(/\s+/).every((m) => txt.includes(m))
        }
      }
    })
    if (!ok) return false
  }
  return true
}
