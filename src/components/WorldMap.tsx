import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import world110 from 'world-atlas/countries-110m.json'
import { TOULOUSE, distanceKm } from '../../lib/geo.js'
import { MERS, NOMS_PAYS, RANG, REPERES, type Niveau } from './reperesCarte'

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

  const { path, proj, large, niveauBase } = useMemo(() => {
    let [[x0, y0], [x1, y1]] = vue === 'auto' ? cadreAuto(trajets) : CADRES[vue]
    const large = vue === 'monde' || x1 - x0 > 70
    if (large && vue === 'auto') [[x0, y0], [x1, y1]] = [[Math.max(-170, x0), Math.max(-55, y0)], [Math.min(179, x1), Math.min(72, y1)]]
    const cadre = { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[x0, y0], [x1, y1], [x0, y1], [x1, y0], [(x0 + x1) / 2, y1], [(x0 + x1) / 2, y0]] } } as any
    const proj = (large
      ? d3.geoNaturalEarth1().rotate([vue === 'monde' ? 0 : -(x0 + x1) / 2, 0])
      : d3.geoConicConformal().parallels([40, 55]).rotate([-(x0 + x1) / 2, 0])
    ).fitExtent([[14, 14], [W - 14, H - 14]], cadre)
    const niveauBase: Niveau = large ? 'monde' : x1 - x0 > 22 ? 'europe' : 'france'
    return { path: d3.geoPath(proj), proj, large, niveauBase }
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
    return geo.features.map((f: any) => {
      const id = String(f.id)
      let lab: { x: number; y: number; aire: number; nom: string } | null = null
      if (NOMS_PAYS[id]) {
        // Étiquette au centre du plus grand polygone (évite la France placée en Guyane).
        const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]
        const g = polys
          .map((c: any) => ({ type: 'Polygon', coordinates: c }))
          .map((poly: any) => ({ poly, aire: path.area(poly) }))
          .sort((a: any, b: any) => b.aire - a.aire)[0]
        const c = g && path.centroid(g.poly)
        if (c && isFinite(c[0])) lab = { x: c[0], y: c[1], aire: g.aire, nom: NOMS_PAYS[id] }
      }
      return { id, d: path(f) ?? '', lab }
    })
  }, [path, large, detail])
  const sphere = useMemo(() => path({ type: 'Sphere' } as any) ?? '', [path])
  const graticule = useMemo(() => path(d3.geoGraticule10()) ?? '', [path])

  const k = zoom.k
  // Les prêts à Toulouse même écraseraient l'échelle : on la cale sur les autres villes, Toulouse est plafonnée.
  const max = d3.max(points.filter((p) => p.lat !== TOULOUSE[0] || p.lon !== TOULOUSE[1]), (p) => p.valeur) ?? d3.max(points, (p) => p.valeur) ?? 1
  const r = d3.scaleSqrt().domain([0, max]).range([0, rMax]).clamp(true)
  const tri = points.slice().sort((a, b) => b.valeur - a.valeur)
  const tlse = proj([TOULOUSE[1], TOULOUSE[0]])!
  // Étiquettes des plus grosses villes, sans chevauchement (placement glouton en coordonnées écran).
  const aEtiqueter = new Set<string>()
  {
    const poses: [number, number, number][] = [[tlse[0] * zoom.k + zoom.x - 70, tlse[1] * zoom.k + zoom.y, 70]]
    for (const p of tri) {
      if (aEtiqueter.size >= etiquettes) break
      const xy = proj([p.lon, p.lat])
      if (!xy || (p.lat === TOULOUSE[0] && p.lon === TOULOUSE[1])) continue
      const [x, y] = [xy[0] * zoom.k + zoom.x, xy[1] * zoom.k + zoom.y]
      if (x < 0 || x > W - 40 || y < 10 || y > H) continue
      const larg = p.label.replace(/ \(.*\)$/, '').length * 7 + 14
      if (poses.some(([x0, y0, l0]) => x < x0 + l0 && x + larg > x0 && Math.abs(y - y0) < 16)) continue
      poses.push([x, y, larg])
      aEtiqueter.add(p.key)
    }
  }
  const niveau: Niveau = niveauBase === 'europe' && k >= 2.2 ? 'france' : niveauBase === 'monde' && k >= 3 ? 'europe' : niveauBase
  const visible = (x: number, y: number) => x > 4 && x < W - 4 && y > 8 && y < H - 4

  // Villes de référence absentes des données, placées après les étiquettes de données.
  const nomsDonnees = new Set(points.map((p) => p.label.replace(/ \(.*\)$/, '')))
  const reperes: { x: number; y: number; nom: string }[] = []
  let posesEtiquettes: [number, number, number][] = []
  {
    const poses: [number, number, number][] = [[tlse[0] * k + zoom.x - 70, tlse[1] * k + zoom.y, 70]]
    tri.filter((p) => aEtiqueter.has(p.key)).forEach((p) => {
      const xy = proj([p.lon, p.lat])
      if (xy) poses.push([xy[0] * k + zoom.x, xy[1] * k + zoom.y, p.label.replace(/ \(.*\)$/, '').length * 7 + 14])
    })
    REPERES.filter(([nom, , , niv]) => RANG[niveau] >= RANG[niv] && !nomsDonnees.has(nom)).forEach(([nom, lat, lon]) => {
      const xy = proj([lon, lat])
      if (!xy) return
      const [x, y] = [xy[0] * k + zoom.x, xy[1] * k + zoom.y]
      const l = nom.length * 6 + 10
      if (!visible(x, y) || x > W - l || poses.some(([x0, y0, l0]) => x < x0 + l0 && x + l > x0 && Math.abs(y - y0) < 14)) return
      poses.push([x, y, l])
      reperes.push({ x: xy[0], y: xy[1], nom })
    })
    posesEtiquettes = poses
  }
  // Noms de pays : seulement ceux assez grands à l'écran, sans chevaucher les autres étiquettes (on tente un léger décalage).
  const nomsPays: { x: number; y: number; nom: string }[] = []
  {
    const pris: [number, number, number][] = [...posesEtiquettes]
    const seuil = niveau === 'monde' ? 2600 : 1500
    fond.filter((f: any) => f.lab && f.lab.aire * k * k > seuil).sort((a: any, b: any) => b.lab.aire - a.lab.aire).forEach((f: any) => {
      const l = f.lab.nom.length * 8 + 10
      for (const dy of [0, 14, -14]) {
        const [x, y] = [f.lab.x * k + zoom.x - l / 2, f.lab.y * k + zoom.y + dy]
        if (!visible(x + l / 2, y) || pris.some(([x0, y0, l0]) => x < x0 + l0 && x + l > x0 && Math.abs(y - y0) < 13)) continue
        pris.push([x, y, l])
        nomsPays.push({ x: f.lab.x, y: f.lab.y + dy / k, nom: f.lab.nom })
        break
      }
    })
  }
  const mers = MERS.filter(([, , , nivs]) => nivs.includes(niveau)).map(([nom, lat, lon]) => ({ nom, xy: proj([lon, lat]) })).filter((m) => m.xy)

  // Échelle graphique (vues rapprochées) : longueur « ronde » d'environ 100 px à l'écran.
  let echelle: { px: number; km: number } | null = null
  if (!large) {
    const a = proj.invert!([W / 2, H / 2]), b = proj.invert!([W / 2 + 100 / k, H / 2])
    if (a && b) {
      const kmPar100 = distanceKm([a[1], a[0]], [b[1], b[0]])
      const km = [10, 20, 50, 100, 200, 250, 500, 1000, 2000].find((v) => v >= kmPar100 * 0.8) ?? 2000
      echelle = { km, px: (100 * km) / kmPar100 }
    }
  }
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
          {mers.map((m) => (
            <text key={m.nom + m.xy![0]} x={m.xy![0]} y={m.xy![1]} className="carte-mer" style={{ fontSize: 11.5 / k }} textAnchor="middle">{m.nom}</text>
          ))}
          {nomsPays.map((n) => (
            <text key={n.nom} x={n.x} y={n.y} className="carte-nom-pays" style={{ fontSize: 10 / k, letterSpacing: 1.2 / k }} textAnchor="middle">{n.nom}</text>
          ))}
          {reperes.map((r) => (
            <g key={r.nom} className="carte-repere">
              <circle cx={r.x} cy={r.y} r={2.2 / Math.sqrt(k)} strokeWidth={1 / k} />
              <text x={r.x + 5 / k} y={r.y + 3.5 / k} style={{ fontSize: 10.5 / k, strokeWidth: 2.5 / k }}>{r.nom}</text>
            </g>
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
      {echelle && (
        <div className="carte-echelle" aria-label={`Échelle : ${echelle.km} km`} style={{ width: `calc(${(100 * echelle.px) / W}% + 16px)` }}>
          <span />
          {echelle.km} km
        </div>
      )}
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
