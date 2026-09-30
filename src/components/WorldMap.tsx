import { useMemo, useState } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import world from 'world-atlas/countries-110m.json'
import { TOULOUSE } from '../../lib/geo.js'

export type Vue = 'monde' | 'europe' | 'france' | 'auto'
export interface Point {
  key: string
  lat: number
  lon: number
  valeur: number
  label: string
  detail?: string
}
export interface Trajet {
  lat: number
  lon: number
  etat: 'fait' | 'actif' | 'futur'
  label?: string
}

const PAYS_GEO = feature(world as any, (world as any).objects.countries) as any
const CADRES: Record<Exclude<Vue, 'auto'>, [[number, number], [number, number]]> = {
  monde: [[-160, -50], [178, 72]],
  europe: [[-9, 36], [22, 57]],
  france: [[-4.8, 42.2], [8.4, 51.2]],
}
const W = 960

/** Cadre ajusté à Toulouse + destinations, avec une marge et une taille minimale. */
function cadreAuto(trajets: Trajet[]): [[number, number], [number, number]] {
  const lons = [TOULOUSE[1], ...trajets.map((t) => t.lon)]
  const lats = [TOULOUSE[0], ...trajets.map((t) => t.lat)]
  let [x0, x1] = [Math.min(...lons), Math.max(...lons)]
  let [y0, y1] = [Math.min(...lats), Math.max(...lats)]
  const mx = Math.max(8 - (x1 - x0), 0) / 2 + (x1 - x0) * 0.12
  const my = Math.max(5 - (y1 - y0), 0) / 2 + (y1 - y0) * 0.15
  ;[x0, x1, y0, y1] = [x0 - mx, x1 + mx, y0 - my, y1 + my]
  return [[x0, y0], [x1, y1]]
}

export function WorldMap({
  points = [],
  trajets = [],
  vue,
  hauteur = 480,
  selection,
  onSelect,
  paysMarques = [],
  rMax = 26,
}: {
  points?: Point[]
  trajets?: Trajet[]
  vue: Vue
  hauteur?: number
  selection?: string | null
  onSelect?: (key: string) => void
  paysMarques?: string[]
  rMax?: number
}) {
  const [survol, setSurvol] = useState<Point | null>(null)
  const H = hauteur
  const { path, proj } = useMemo(() => {
    let [[x0, y0], [x1, y1]] = vue === 'auto' ? cadreAuto(trajets) : CADRES[vue]
    const large = x1 - x0 > 70
    if (large) [[x0, y0], [x1, y1]] = [[Math.max(-170, x0), Math.max(-55, y0)], [Math.min(179, x1), Math.min(72, y1)]]
    const cadre = {
      type: 'Feature',
      geometry: { type: 'MultiPoint', coordinates: [[x0, y0], [x1, y1], [x0, y1], [x1, y0], [(x0 + x1) / 2, y1]] },
    } as any
    const proj = (vue === 'monde' || large ? d3.geoNaturalEarth1().rotate([-(x0 + x1) / 2 * (vue === 'monde' ? 0 : 1), 0]) : d3.geoConicConformal().parallels([40, 55]).rotate([-6, 0]))
      .fitExtent([[12, 12], [W - 12, H - 12]], cadre)
    return { path: d3.geoPath(proj), proj }
  }, [vue, H, vue === 'auto' ? trajets.map((t) => t.lat + ',' + t.lon).join(';') : ''])

  const max = d3.max(points, (p) => p.valeur) ?? 1
  const r = d3.scaleSqrt().domain([0, max]).range([0, rMax])
  const tri = points.slice().sort((a, b) => b.valeur - a.valeur)
  const tlse = proj([TOULOUSE[1], TOULOUSE[0]])!
  const marques = new Set(paysMarques)

  return (
    <div className="carte" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Carte des destinations des prêts">
        <path d={path({ type: 'Sphere' } as any) ?? ''} className="carte-ocean" />
        <path d={path(d3.geoGraticule10()) ?? ''} className="carte-graticule" />
        {PAYS_GEO.features.map((f: any) => (
          <path key={f.id + (f.properties?.name ?? '')} d={path(f) ?? ''} className={'carte-pays' + (marques.has(f.id) ? ' marque' : '')} />
        ))}
        {trajets.map((t, i) => (
          <path
            key={'t' + i}
            d={path({ type: 'LineString', coordinates: [[TOULOUSE[1], TOULOUSE[0]], [t.lon, t.lat]] } as any) ?? ''}
            className={'carte-trajet ' + t.etat}
          />
        ))}
        {tri.map((p) => {
          const xy = proj([p.lon, p.lat])
          if (!xy) return null
          const sel = selection === p.key
          return (
            <circle
              key={p.key}
              cx={xy[0]}
              cy={xy[1]}
              r={Math.max(3, r(p.valeur))}
              className={'carte-bulle' + (sel ? ' sel' : '') + (onSelect ? ' cliquable' : '')}
              onMouseEnter={() => setSurvol(p)}
              onMouseLeave={() => setSurvol(null)}
              onClick={() => onSelect?.(p.key)}
            >
              <title>{p.label + (p.detail ? ' : ' + p.detail : '')}</title>
            </circle>
          )
        })}
        {trajets.map((t, i) => {
          const xy = proj([t.lon, t.lat])
          return xy && t.etat !== 'futur' ? (
            <g key={'e' + i}>
              <circle cx={xy[0]} cy={xy[1]} r={t.etat === 'actif' ? 7 : 4} className={'carte-etape ' + t.etat} />
              {t.etat === 'actif' && t.label && <text x={xy[0] + (xy[0] > W - 160 ? -10 : 10)} y={xy[1] + 18} textAnchor={xy[0] > W - 160 ? 'end' : 'start'} className="carte-label">{t.label}</text>}
            </g>
          ) : null
        })}
        <g className="carte-toulouse">
          <circle cx={tlse[0]} cy={tlse[1]} r={5} />
          <text x={tlse[0] + 8} y={tlse[1] - 8}>Toulouse</text>
        </g>
      </svg>
      {survol && (() => {
        const xy = proj([survol.lon, survol.lat])!
        return (
          <div className="infobulle" style={{ left: `${(100 * xy[0]) / W}%`, top: `${(100 * xy[1]) / H}%` }}>
            <strong>{survol.label}</strong>
            {survol.detail && <span>{survol.detail}</span>}
          </div>
        )
      })()}
    </div>
  )
}
