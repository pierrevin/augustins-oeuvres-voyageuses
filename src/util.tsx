import { useState, type ReactNode } from 'react'
import type { Domaine, Oeuvre, Payload, Pret } from '../lib/types.js'

export const COULEUR_DOMAINE: Record<Domaine, string> = {
  Peinture: '#b4532a',
  Sculpture: '#2a6fc0',
  'Arts graphiques': '#d19a1f',
  'Autre ou inconnu': '#2e8f55',
}

export const nf = new Intl.NumberFormat('fr-FR')
export const fmt = (n: number) => nf.format(Math.round(n))
export const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0)
export const dateFr = (iso: string | null | undefined) => {
  if (!iso) return '?'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
export const moisAnnee = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
export const siecleRomain = (s: number | null) => {
  if (!s) return 'Date inconnue'
  const r: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let n = s
  let out = ''
  for (const [v, l] of r) while (n >= v) { out += l; n -= v }
  return out + (s === 1 ? 'er' : 'e') + ' siècle'
}

export interface Index {
  data: Payload
  oeuvre: Map<string, Oeuvre>
  pretsParOeuvre: Map<string, Pret[]>
}
export function indexer(data: Payload): Index {
  const oeuvre = new Map(data.oeuvres.map((o) => [o.id, o]))
  const pretsParOeuvre = new Map<string, Pret[]>()
  data.prets.forEach((p) => pretsParOeuvre.set(p.oeuvreId, [...(pretsParOeuvre.get(p.oeuvreId) ?? []), p]))
  return { data, oeuvre, pretsParOeuvre }
}

/** Image avec chaîne de repli : on essaie chaque URL, puis une vignette neutre. */
export function Img({ srcs, alt, className, fallback, eager }: { srcs: string[]; alt: string; className?: string; fallback?: ReactNode; eager?: boolean }) {
  const [i, setI] = useState(0)
  if (i >= srcs.length)
    return (
      <div className={'img-vide ' + (className ?? '')} role="img" aria-label={alt + ' (image indisponible)'}>
        {fallback ?? <span>Image indisponible</span>}
      </div>
    )
  return <img className={className} src={srcs[i]} alt={alt} loading={eager ? "eager" : "lazy"} onError={() => setI(i + 1)} />
}

export function telechargerCsv(nom: string, lignes: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v === null ? '' : String(v)
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const csv = '﻿' + lignes.map((l) => l.map(esc).join(';')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = nom
  a.click()
  URL.revokeObjectURL(a.href)
}

export function stockage<T>(cle: string, defaut: T): [() => T, (v: T) => void] {
  return [
    () => {
      try {
        const v = localStorage.getItem(cle)
        return v ? (JSON.parse(v) as T) : defaut
      } catch {
        return defaut
      }
    },
    (v: T) => {
      try {
        localStorage.setItem(cle, JSON.stringify(v))
      } catch {
        /* stockage indisponible : on garde l'état en mémoire */
      }
    },
  ]
}

export const melanger = <T,>(a: T[]) => {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}
