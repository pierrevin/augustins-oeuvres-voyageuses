import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import world110 from 'world-atlas/countries-110m.json'
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

const versGeo = (w: any) => feature(w, w.objects.countries) as any
const PAYS_110 = versGeo(world110)
// Contours détaillés (1:50 000 000) chargés à la demande pour les vues rapprochées.
let pays50: any = null
let chargement50: Promise<any> | null = null
const charger50 = () =>
  (chargement50 ??= import('world-atlas/countries-50m.json').then((m) => (pays50 = versGeo(m.default ?? m))))

const CADRES: Record<Exclude<Vue, 'auto'>, [[number, number], [number, number]]> = {
  monde: [[-160, -48], [178, 70]],
  europe: [[-9, 36], [22, 57]],
  france: [[-4.8, 42.2], [8.4, 51.2]],
}
const W = 960

/** Cadre ajusté à Toulouse + destinations, avec une marge et une taille minimale (la France reste lisible). */
function cadreAuto(trajets: Trajet[]): [[number, number], [number, number]] {
  const lons = [TOULOUSE[1], ...trajets.map((t) => t.lon)]
  const lats = [TOULOUSE[0], ...trajets.map((t) => t.lat)]
  let [x0, x1] = [Math.min(...lons), Math.max(...lons)]
  let [y0, y1] = [Math.min(...lats), Math.max(...lats)]
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const dx = Math.max(x1 - x0, 13) * 1.25, dy = Math.max(y1 - y0, 8.5) * 1.3
  ;[x0, x1, y0, y1] = [cx - dx / 2, cx + dx / 2, cy - dy / 2, cy + dy / 2]
  return [[x0, y0], [x1, y1]]
}

/** Arc courbe entre deux points écran : plus lisible qu'une ligne droite quand les trajets se superposent. */
function arc(a: [number, number], b: [number, number]) {
  const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const d = Math.hypot(dx, dy) || 1
  const h = Math.min(d * 0.22, 120)
  let [nx, ny] = [-dy / d, dx / d]
  if (ny > 0) [nx, ny] = [-nx, -ny] // on bombe toujours vers le haut
  return `M${a[0]},${a[1]} Q${mx + nx * h},${my + ny * h} ${b[0]},${b[1]}`
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
  etiquettes = 0,
}: {
  points?: Point[]
  trajets?: Trajet[]
  vue: Vue
  hauteur?: number
  selection?: string | null
  onSelect?: (key: string) => void
  paysMarques?: string[]
  rMax?: number
  /** Nombre de villes (les plus grosses) étiquetées en permanence. */
  etiquettes?: number
}) {
  const [survol, setSurvol] = useState<Point | null>(null)
  const [zoom, setZoom] = useState(d3.zoomIdentity)
  const [detail, setDetail] = useState<any>(pays50)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const H = hauteur
  const cleTrajets = vue === 'auto' ? trajets.map((t) => t.lat + ',' + t.lon).join(';') : ''

  const { path, proj, large } = useMemo(() => {
    let [[x0, y0], [x1, y1]] = vue === 'auto' ? cadreAuto(trajets) : CADRES[vue]
    const large = vue === 'monde' || x1 - x0 > 70
    if (large && vue === 'auto') [[x0, y0], [x1, y1]] = [[Math.max(-170, x0), Math.max(-55, y0)], [Math.min(179, x1), Math.min(72, y1)]]
    const cadre = { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[x0, y0], [x1, y1], [x0, y1], [x1, y0], [(x0 + x1) / 2, y1], [(x0 + x1) / 2, y0]] } } as any
    const proj = (large
      ? d3.geoNaturalEarth1().rotate([vue === 'monde' ? 0 : -(x0 + x1) / 2, 0])
      : d3.geoConicConformal().parallels([40, 55]).rotate([-(x0 + x1) / 2, 0])
    ).fitExtent([[14, 14], [W - 14, H - 14]], cadre)
    return { path: d3.geoPath(proj), proj, large }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vue, H, cleTrajets])

  useEffect(() => {
    if (!large && !detail) charger50().then(setDetail)
  }, [large, detail])

  // Zoom et déplacement (molette, pincement, boutons).
  useEffect(() => {
    const svg = d3.select(svgRef.current!)
    const z = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .translateExtent([[0, 0], [W, H]])
      .filter((e) => (e.type === 'wheel' ? e.ctrlKey || e.metaKey || e.shiftKey : !e.button))
      .on('zoom', (e) => setZoom(e.transform))
    zoomRef.current = z
    svg.call(z)
    svg.call(z.transform, d3.zoomIdentity)
    return () => { svg.on('.zoom', null) }
  }, [path, H])
  const zoomer = (f: number) => zoomRef.current && d3.select(svgRef.current!).transition().duration(300).call(zoomRef.current.scaleBy, f)
  const reinit = () => zoomRef.current && d3.select(svgRef.current!).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity)

  const fond = useMemo(() => {
    const geo = !large && detail ? detail : PAYS_110
    return geo.features.map((f: any) => ({ id: String(f.id), d: path(f) ?? '' }))
  }, [path, large, detail])
  const sphere = useMemo(() => path({ type: 'Sphere' } as any) ?? '', [path])
  const graticule = useMemo(() => path(d3.geoGraticule10()) ?? '', [path])

  const k = zoom.k
  const max = d3.max(points, (p) => p.valeur) ?? 1
  const r = d3.scaleSqrt().domain([0, max]).range([0, rMax])
  const tri = points.slice().sort((a, b) => b.valeur - a.valeur)
  const aEtiqueter = new Set(tri.slice(0, etiquettes).map((p) => p.key))
  const tlse = proj([TOULOUSE[1], TOULOUSE[0]])!
  const marques = new Set(paysMarques)
  const ecran = (xy: [number, number]) => [xy[0] * k + zoom.x, xy[1] * k + zoom.y]

  return (
    <div className="carte" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Carte des destinations des prêts">
        <g transform={zoom.toString()}>
          <path d={sphere} className="carte-ocean" />
          <path d={graticule} className="carte-graticule" />
          {fond.map((f: { id: string; d: string }, i: number) => (
            <path key={f.id + i} d={f.d} className={'carte-pays' + (marques.has(f.id) ? ' marque' : '')} />
          ))}
          {trajets.map((t, i) => {
            const b = proj([t.lon, t.lat])
            return b ? <path key={'t' + i} d={arc(tlse as [number, number], b)} className={'carte-trajet ' + t.etat} /> : null
          })}
          {tri.map((p) => {
            const xy = proj([p.lon, p.lat])
            if (!xy) return null
            const sel = selection === p.key
            return (
              <circle
                key={p.key}
                cx={xy[0]}
                cy={xy[1]}
                r={Math.max(3, r(p.valeur)) / Math.sqrt(k)}
                strokeWidth={1.2 / k}
                className={'carte-bulle' + (sel ? ' sel' : '') + (onSelect ? ' cliquable' : '')}
                onMouseEnter={() => setSurvol(p)}
                onMouseLeave={() => setSurvol(null)}
                onClick={() => onSelect?.(p.key)}
              >
                <title>{p.label + (p.detail ? ' : ' + p.detail : '')}</title>
              </circle>
            )
          })}
          {tri.filter((p) => aEtiqueter.has(p.key) && p.lat !== TOULOUSE[0]).map((p) => {
            const xy = proj([p.lon, p.lat])
            if (!xy) return null
            return (
              <text key={'l' + p.key} x={xy[0] + (Math.max(3, r(p.valeur)) / Math.sqrt(k)) + 3 / k} y={xy[1] + 4 / k} className="carte-ville" style={{ fontSize: 12 / k, strokeWidth: 3 / k }}>
                {p.label.replace(/ \(.*\)$/, '')}
              </text>
            )
          })}
          {trajets.map((t, i) => {
            const xy = proj([t.lon, t.lat])
            if (!xy || t.etat === 'futur') return null
            const droite = ecran(xy)[0] > W - 160
            return (
              <g key={'e' + i}>
                <circle cx={xy[0]} cy={xy[1]} r={(t.etat === 'actif' ? 7 : 4) / Math.sqrt(k)} strokeWidth={1.5 / k} className={'carte-etape ' + t.etat} />
                {t.etat === 'actif' && t.label && (
                  <text x={xy[0] + (droite ? -10 : 10) / k} y={xy[1] + 18 / k} textAnchor={droite ? 'end' : 'start'} className="carte-label" style={{ fontSize: 14 / k, strokeWidth: 4 / k }}>
                    {t.label}
                  </text>
                )}
              </g>
            )
          })}
          <g className="carte-toulouse">
            <circle cx={tlse[0]} cy={tlse[1]} r={5 / Math.sqrt(k)} strokeWidth={2 / k} />
            <text x={tlse[0] - 8 / k} y={tlse[1] - 8 / k} textAnchor="end" style={{ fontSize: 13 / k, strokeWidth: 3 / k }}>Toulouse</text>
          </g>
        </g>
      </svg>
      <div className="carte-zoom" title="Zoom : boutons, double-clic ou Ctrl + molette. Glisser pour se déplacer.">
        <button onClick={() => zoomer(1.6)} aria-label="Zoomer">+</button>
        <button onClick={() => zoomer(1 / 1.6)} aria-label="Dézoomer">−</button>
        {k > 1.01 && <button onClick={reinit} aria-label="Recentrer" className="texte">Recentrer</button>}
      </div>
      {survol && (() => {
        const [x, y] = ecran(proj([survol.lon, survol.lat])!)
        return (
          <div className="infobulle" style={{ left: `${(100 * x) / W}%`, top: `${(100 * y) / H}%` }}>
            <strong>{survol.label}</strong>
            {survol.detail && <span>{survol.detail}</span>}
          </div>
        )
      })()}
    </div>
  )
}
