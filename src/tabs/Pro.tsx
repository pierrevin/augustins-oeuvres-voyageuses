import { useMemo, useState } from 'react'
import * as d3 from 'd3'
import { DOMAINES, type Domaine, type Pret } from '../../lib/types.js'
import { WorldMap, type Vue } from '../components/WorldMap'
import { useFiche } from '../components/Fiches'
import { Recherche, correspond, type Filtre } from '../components/Recherche'
import { BlocMusees } from '../components/Musees'
import { COULEUR_DOMAINE, Img, dateFr, fmt, pct, telechargerCsv, type Index } from '../util'

type Zone = 'tout' | 'france' | 'etranger'

export function Pro({ idx }: { idx: Index }) {
  const { data } = idx
  const annees = d3.extent(data.prets, (p) => p.annee) as [number, number]
  const [de, setDe] = useState(annees[0])
  const [a, setA] = useState(annees[1])
  const [domaines, setDomaines] = useState<Set<Domaine>>(new Set(DOMAINES))
  const [zone, setZone] = useState<Zone>('tout')
  const [filtres, setFiltres] = useState<Filtre[]>([])

  const prets = useMemo(() => {
    return data.prets.filter((p) => {
      const o = idx.oeuvre.get(p.oeuvreId)!
      if (p.annee < de || p.annee > a) return false
      if (!domaines.has(o.domaine)) return false
      if (zone === 'france' && p.pays !== 'France') return false
      if (zone === 'etranger' && p.pays === 'France') return false
      return correspond(filtres, p, o)
    })
  }, [data, idx, de, a, domaines, zone, filtres])

  const basculer = (d: Domaine) => {
    const s = new Set(domaines)
    if (s.has(d) && s.size > 1) s.delete(d)
    else s.add(d)
    setDomaines(s)
  }
  const reinit = () => {
    setDe(annees[0]); setA(annees[1]); setDomaines(new Set(DOMAINES)); setZone('tout'); setFiltres([])
  }

  return (
    <div className="pro">
      <section className="intro-pro">
        <h1>Tableau de bord des prêts</h1>
        <p>{fmt(data.prets.length)} prêts enregistrés de {annees[0]} à {annees[1]}, croisés avec l’inventaire ({fmt(data.collection.totalInventaire)} œuvres) et le registre des dépôts. Tous les graphiques suivent les filtres.</p>
      </section>

      <div className="filtres flottants" role="group" aria-label="Filtres">
        <Recherche idx={idx} filtres={filtres} setFiltres={setFiltres} />
        <label>Période
          <span className="plage">
            <select value={de} onChange={(e) => setDe(Math.min(+e.target.value, a))}>
              {d3.range(annees[0], annees[1] + 1).map((y) => <option key={y}>{y}</option>)}
            </select>
            à
            <select value={a} onChange={(e) => setA(Math.max(+e.target.value, de))}>
              {d3.range(annees[0], annees[1] + 1).map((y) => <option key={y}>{y}</option>)}
            </select>
          </span>
        </label>
        <div className="puces" aria-label="Domaines">
          {DOMAINES.map((d) => (
            <button key={d} className={'puce' + (domaines.has(d) ? ' on' : '')} onClick={() => basculer(d)} aria-pressed={domaines.has(d)}>
              <i style={{ background: COULEUR_DOMAINE[d] }} />{d}
            </button>
          ))}
        </div>
        <div className="segment">
          {(['tout', 'france', 'etranger'] as Zone[]).map((z) => (
            <button key={z} className={zone === z ? 'on' : ''} onClick={() => setZone(z)}>{{ tout: 'Partout', france: 'France', etranger: 'Étranger' }[z]}</button>
          ))}
        </div>
        <span className="compteur-filtre"><strong>{fmt(prets.length)}</strong> prêt{prets.length > 1 ? 's' : ''}</span>
        {(filtres.length > 0 || zone !== 'tout' || domaines.size < DOMAINES.length || de !== annees[0] || a !== annees[1]) && <button className="lien" onClick={reinit}>Réinitialiser</button>}
      </div>

      <Indicateurs prets={prets} idx={idx} />
      <div className="grille-2">
        <Frise prets={prets} idx={idx} annees={[de, a]} />
        <Rotation idx={idx} />
      </div>
      <CarteDestinations prets={prets} filtrerVille={(k, label) => !filtres.some((f) => f.valeur === k) && setFiltres([...filtres, { type: 'ville', valeur: k, label }])} />
      <HorsLesMurs idx={idx} />
      <BlocMusees prets={prets} titre="Institutions emprunteuses" sous="Qui emprunte, depuis quand, combien d’œuvres. Les cartes suivent les filtres. Cliquez pour voir les expositions et les œuvres prêtées." />
      <Classements prets={prets} idx={idx} />
      <Tableau prets={prets} idx={idx} />
    </div>
  )
}

function Indicateurs({ prets, idx }: { prets: Pret[]; idx: Index }) {
  const oeuvres = new Set(prets.map((p) => p.oeuvreId))
  const k = [
    { v: prets.length, l: 'prêts' },
    { v: oeuvres.size, l: 'œuvres différentes' },
    { v: new Set(prets.map((p) => p.musee + '|' + p.ville)).size, l: 'institutions emprunteuses' },
    { v: new Set(prets.map((p) => p.ville + p.pays)).size, l: 'villes' },
    { v: new Set(prets.map((p) => p.pays)).size, l: 'pays' },
    { v: d3.sum(prets, (p) => p.jours ?? 0), l: 'jours hors les murs (cumul)' },
  ]
  const etranger = prets.filter((p) => p.pays !== 'France').length
  const programmes = prets.filter((p) => p.programme).length
  const inverses = prets.filter((p) => p.datesInversees).length
  return (
    <section className="kpis">
      {k.map((x) => (
        <div className="kpi" key={x.l}><strong>{fmt(x.v)}</strong><span>{x.l}</span></div>
      ))}
      <p className="kpis-note">
        {pct(etranger, prets.length)} % des prêts partent à l’étranger. {programmes > 0 && <>{programmes} prêts sont postérieurs à la dernière mise à jour du jeu (programmés). </>}
        {inverses > 0 && <>{inverses} prêts aux dates incohérentes sont exclus des cumuls de jours. </>}
        {idx.data.images.cassees > 0 && <>Détails dans « Coulisses des données ».</>}
      </p>
    </section>
  )
}

function Frise({ prets, idx, annees }: { prets: Pret[]; idx: Index; annees: [number, number] }) {
  const [survol, setSurvol] = useState<number | null>(null)
  const W = 640, H = 260, m = { t: 12, r: 8, b: 26, l: 34 }
  const ans = d3.range(annees[0], annees[1] + 1)
  const parAn = ans.map((y) => {
    const r: Record<string, number> = { annee: y }
    DOMAINES.forEach((d) => (r[d] = 0))
    prets.filter((p) => p.annee === y).forEach((p) => r[idx.oeuvre.get(p.oeuvreId)!.domaine]++)
    return r
  })
  const pile = d3.stack<Record<string, number>>().keys(DOMAINES)(parAn)
  const x = d3.scaleBand<number>().domain(ans).range([m.l, W - m.r]).padding(0.18)
  const y = d3.scaleLinear().domain([0, d3.max(parAn, (r) => d3.sum(DOMAINES, (d) => r[d])) || 1]).nice().range([H - m.b, m.t])
  const pas = Math.ceil(ans.length / 10)
  const s = survol !== null ? parAn.find((r) => r.annee === survol) : null
  return (
    <section className="bloc">
      <h2>Prêts par année de départ</h2>
      <Legende />
      <div className="graphe">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Nombre de prêts par année, par domaine">
          {y.ticks(5).map((t) => (
            <g key={t}>
              <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="grille" />
              <text x={m.l - 6} y={y(t)} className="axe" textAnchor="end" dominantBaseline="middle">{t}</text>
            </g>
          ))}
          {pile.map((serie) => (
            <g key={serie.key} fill={COULEUR_DOMAINE[serie.key as Domaine]}>
              {serie.map((seg) => {
                const h = y(seg[0]) - y(seg[1])
                return h > 0 ? <rect key={seg.data.annee} x={x(seg.data.annee)} y={y(seg[1]) + 1} width={x.bandwidth()} height={Math.max(0, h - 2)} rx={1.5} /> : null
              })}
            </g>
          ))}
          {ans.map((yy, i) => (
            <g key={yy}>
              {i % pas === 0 && <text x={x(yy)! + x.bandwidth() / 2} y={H - 8} className="axe" textAnchor="middle">{yy}</text>}
              <rect x={x(yy)! - 2} y={m.t} width={x.bandwidth() + 4} height={H - m.t - m.b} fill="transparent" onMouseEnter={() => setSurvol(yy)} onMouseLeave={() => setSurvol(null)} />
            </g>
          ))}
        </svg>
        {s && (
          <div className="infobulle fixe" style={{ left: `${(100 * (x(survol!)! + x.bandwidth() / 2)) / W}%`, top: '8%' }}>
            <strong>{survol} : {d3.sum(DOMAINES, (d) => s[d])} prêts</strong>
            {DOMAINES.filter((d) => s[d]).map((d) => <span key={d}><i style={{ background: COULEUR_DOMAINE[d] }} />{d} : {s[d]}</span>)}
          </div>
        )}
      </div>
    </section>
  )
}

export function Legende() {
  return (
    <div className="legende">
      {DOMAINES.map((d) => <span key={d}><i style={{ background: COULEUR_DOMAINE[d] }} />{d}</span>)}
    </div>
  )
}

function Rotation({ idx }: { idx: Index }) {
  const d = idx.data.collection.domaines.filter((x) => x.total > 0)
  return (
    <section className="bloc">
      <h2>Part du fonds qui a voyagé</h2>
      <p className="sous">Œuvres de l’inventaire prêtées au moins une fois, par domaine (hors filtres).</p>
      <div className="barres">
        {d.map((x) => (
          <div className="barre-ligne" key={x.domaine}>
            <span className="barre-label">{x.domaine}</span>
            <div className="barre-piste" title={`${x.pretees} sur ${x.total}`}>
              <div className="barre" style={{ width: `${pct(x.pretees, x.total)}%`, background: COULEUR_DOMAINE[x.domaine] }} />
            </div>
            <span className="barre-val"><strong>{pct(x.pretees, x.total)} %</strong> <small>{x.pretees}/{fmt(x.total)}</small></span>
          </div>
        ))}
      </div>
      <p className="note">Une peinture a bien plus de chances de voyager qu’une sculpture. Piste d’explication : une grande partie des sculptures de l’inventaire sont des éléments d’architecture (chapiteaux, bases, culs-de-lampe).</p>
    </section>
  )
}

function CarteDestinations({ prets, filtrerVille }: { prets: Pret[]; filtrerVille: (k: string, label: string) => void }) {
  const [vue, setVue] = useState<Vue>('monde')
  const [sel, setSel] = useState<string | null>(null)
  const parVille = d3.rollups(prets.filter((p) => p.lat !== null), (v) => v, (p) => p.ville + '|' + p.pays)
  const points = parVille.map(([k, v]) => ({
    key: k, lat: v[0].lat!, lon: v[0].lon!, valeur: v.length,
    label: `${v[0].ville} (${v[0].pays})`, detail: `${v.length} prêt${v.length > 1 ? 's' : ''}, ${new Set(v.map((p) => p.musee)).size} institution(s)`,
  }))
  const choix = sel ? parVille.find(([k]) => k === sel)?.[1] ?? [] : []
  const expos = d3.rollups(choix, (v) => v, (p) => p.expo + '|' + p.musee)
  return (
    <section className="bloc">
      <div className="bloc-tete">
        <h2>Où partent les œuvres</h2>
        <div className="segment">
          {(['monde', 'europe', 'france'] as Vue[]).map((v) => <button key={v} className={vue === v ? 'on' : ''} onClick={() => setVue(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
        </div>
      </div>
      <p className="sous">Taille des cercles : nombre de prêts. Cliquez une ville pour voir ses expositions.</p>
      <div className="carte-et-panneau">
        <WorldMap vue={vue} points={points} selection={sel} onSelect={setSel} hauteur={vue === 'monde' ? 470 : 560} rMax={vue === 'monde' ? 16 : 26} etiquettes={vue === 'monde' ? 10 : 40} />
        <aside className="panneau">
          {sel ? (
            <>
              <h3>{choix[0]?.ville} <small>({choix[0]?.pays})</small></h3>
              <p className="sous">{choix.length} prêts, {expos.length} exposition(s)</p>
              <ul className="liste-expos">
                {expos.sort((x, y) => y[1][0].debut.localeCompare(x[1][0].debut)).map(([k, v]) => (
                  <li key={k}><strong>{v[0].expo}</strong><span>{v[0].musee}, {v[0].debut.slice(0, 4)} · {v.length} œuvre{v.length > 1 ? 's' : ''}</span></li>
                ))}
              </ul>
              <div className="panneau-actions">
                <button className="bouton" onClick={() => filtrerVille(sel, choix[0]?.ville ?? sel)}>Filtrer le tableau de bord sur cette ville</button>
                <button className="lien" onClick={() => setSel(null)}>Fermer</button>
              </div>
            </>
          ) : (
            <>
              <h3>Villes les plus visitées</h3>
              <ol className="classement-simple">
                {points.sort((x, y) => y.valeur - x.valeur).slice(0, 12).map((p) => (
                  <li key={p.key}><button className="lien" onClick={() => setSel(p.key)}>{p.label}</button><span>{p.valeur}</span></li>
                ))}
              </ol>
            </>
          )}
        </aside>
      </div>
    </section>
  )
}

function HorsLesMurs({ idx }: { idx: Index }) {
  const ouvrir = useFiche()
  const valides = useMemo(() => idx.data.prets.filter((p) => !p.datesInversees), [idx])
  const record = useMemo(() => {
    let best = { date: valides[0]?.debut ?? '', n: 0 }
    valides.forEach((p) => {
      const n = valides.filter((q) => q.debut <= p.debut && q.fin >= p.debut).length
      if (n > best.n) best = { date: p.debut, n }
    })
    return best
  }, [valides])
  const [date, setDate] = useState(record.date)
  const absents = valides.filter((p) => p.debut <= date && p.fin >= date).sort((a, b) => a.fin.localeCompare(b.fin))
  const annee = date.slice(0, 4)
  const debutA = `${annee}-01-01`, finA = `${annee}-12-31`
  const annuels = valides.filter((p) => p.debut <= finA && p.fin >= debutA).sort((a, b) => a.debut.localeCompare(b.debut))
  const W = 900, rowH = 14, m = { l: 8, r: 8, t: 22 }
  const x = d3.scaleTime().domain([new Date(debutA), new Date(finA)]).range([m.l, W - m.r]).clamp(true)
  const H = m.t + annuels.length * rowH + 6
  return (
    <section className="bloc">
      <h2>Hors les murs à une date donnée</h2>
      <p className="sous">L’outil de la régie : quelles œuvres sont absentes du musée ce jour-là, et quand reviennent-elles ? Record : <button className="lien" onClick={() => setDate(record.date)}>{record.n} œuvres dehors le {dateFr(record.date)}</button>.</p>
      <div className="filtres compact">
        <label>Date <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
        <strong>{absents.length} œuvre{absents.length > 1 ? 's' : ''} hors les murs</strong>
      </div>
      <div className="grille-hlm">
        <ul className="absents">
          {absents.map((p) => {
            const o = idx.oeuvre.get(p.oeuvreId)!
            return (
              <li key={p.id}>
                <button onClick={() => ouvrir({ type: 'oeuvre', id: o.id })}>
                  <Img srcs={o.images} alt={o.titre} className="vignette" />
                  <span><strong>{o.titre}</strong><small>{o.artiste} · {o.inv ?? 'sans n°'}</small><small>{p.ville} ({p.pays}), retour le {dateFr(p.fin)}</small></span>
                </button>
              </li>
            )
          })}
          {absents.length === 0 && <li className="note">Aucune œuvre en prêt à cette date.</li>}
        </ul>
        <div className="gantt">
          <h3>Tous les prêts en cours en {annee} <small>({annuels.length})</small></h3>
          <div className="gantt-scroll">
            <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 600 }} role="img" aria-label={`Diagramme des prêts en ${annee}`}>
              {d3.timeMonth.range(new Date(debutA), new Date(finA)).map((mo) => (
                <g key={+mo}>
                  <line x1={x(mo)} x2={x(mo)} y1={m.t - 4} y2={H} className="grille" />
                  <text x={x(mo) + 3} y={12} className="axe">{mo.toLocaleDateString('fr-FR', { month: 'short' })}</text>
                </g>
              ))}
              {annuels.map((p, i) => {
                const o = idx.oeuvre.get(p.oeuvreId)!
                const x0 = x(new Date(p.debut)), x1 = x(new Date(p.fin))
                return (
                  <rect key={p.id} x={x0} y={m.t + i * rowH} width={Math.max(3, x1 - x0)} height={rowH - 4} rx={2} fill={COULEUR_DOMAINE[o.domaine]} className="gantt-barre" onClick={() => ouvrir({ type: 'oeuvre', id: o.id })}>
                    <title>{`${o.titre} (${o.artiste})\n${p.ville} : ${dateFr(p.debut)} → ${dateFr(p.fin)}`}</title>
                  </rect>
                )
              })}
              <line x1={x(new Date(date))} x2={x(new Date(date))} y1={m.t - 6} y2={H} className="gantt-jour" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}

function Classements({ prets, idx }: { prets: Pret[]; idx: Index }) {
  const ouvrir = useFiche()
  const parOeuvre = d3.rollups(prets, (v) => ({ n: v.length, j: d3.sum(v, (p) => p.jours ?? 0) }), (p) => p.oeuvreId)
  const parMusee = d3.rollups(prets, (v) => ({ n: v.length, ans: new Set(v.map((p) => p.annee)).size, ville: v[0].ville }), (p) => p.musee + '|' + p.ville)
  const parArtiste = d3.rollups(prets, (v) => ({ n: v.length, o: new Set(v.map((p) => p.oeuvreId)).size }), (p) => idx.oeuvre.get(p.oeuvreId)!.artisteId)
  const Liste = ({ titre, items }: { titre: string; items: { k: string; label: string; sous: string; v: number; onClick?: () => void }[] }) => {
    const max = d3.max(items, (i) => i.v) || 1
    return (
      <div className="classement">
        <h3>{titre}</h3>
        <ol>
          {items.map((i) => (
            <li key={i.k}>
              <div className="cl-texte">
                {i.onClick ? <button className="lien" onClick={i.onClick}>{i.label}</button> : <span>{i.label}</span>}
                <small>{i.sous}</small>
              </div>
              <div className="cl-barre"><div style={{ width: `${(100 * i.v) / max}%` }} /></div>
              <span className="cl-val">{fmt(i.v)}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }
  const o = (id: string) => idx.oeuvre.get(id)!
  return (
    <section className="bloc">
      <h2>Classements</h2>
      <div className="grille-4">
        <Liste titre="Œuvres les plus prêtées" items={parOeuvre.sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([id, v]) => ({ k: id, label: o(id).titre, sous: o(id).artiste, v: v.n, onClick: () => ouvrir({ type: 'oeuvre', id }) }))} />
        <Liste titre="Jours hors les murs" items={parOeuvre.sort((a, b) => b[1].j - a[1].j).slice(0, 10).map(([id, v]) => ({ k: id, label: o(id).titre, sous: `${o(id).artiste} · ${v.n} prêts`, v: v.j, onClick: () => ouvrir({ type: 'oeuvre', id }) }))} />
        <Liste titre="Emprunteurs fidèles" items={parMusee.sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([m, v]) => ({ k: m, label: m.split('|')[0], sous: `${v.ville} · ${v.ans} année${v.ans > 1 ? 's' : ''} différente${v.ans > 1 ? 's' : ''}`, v: v.n }))} />
        <Liste titre="Artistes les plus demandés" items={parArtiste.sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([id, v]) => ({ k: id, label: idx.data.artistes.find((x) => x.id === id)?.nom ?? id, sous: `${v.o} œuvre${v.o > 1 ? 's' : ''}`, v: v.n, onClick: () => ouvrir({ type: 'artiste', id }) }))} />
      </div>
    </section>
  )
}

type Col = { k: string; l: string; v: (p: Pret) => string | number }
function Tableau({ prets, idx }: { prets: Pret[]; idx: Index }) {
  const ouvrir = useFiche()
  const [tri, setTri] = useState<{ k: string; asc: boolean }>({ k: 'debut', asc: false })
  const [page, setPage] = useState(0)
  const o = (p: Pret) => idx.oeuvre.get(p.oeuvreId)!
  const cols: Col[] = [
    { k: 'debut', l: 'Début', v: (p) => p.debut },
    { k: 'fin', l: 'Fin', v: (p) => p.fin },
    { k: 'inv', l: 'N° inv.', v: (p) => o(p).inv ?? '' },
    { k: 'titre', l: 'Œuvre', v: (p) => o(p).titre },
    { k: 'artiste', l: 'Artiste', v: (p) => o(p).artiste },
    { k: 'domaine', l: 'Domaine', v: (p) => o(p).domaine },
    { k: 'expo', l: 'Exposition', v: (p) => p.expo },
    { k: 'musee', l: 'Institution', v: (p) => p.musee },
    { k: 'ville', l: 'Ville', v: (p) => p.ville },
    { k: 'pays', l: 'Pays', v: (p) => p.pays },
    { k: 'jours', l: 'Jours', v: (p) => p.jours ?? -1 },
  ]
  const col = cols.find((c) => c.k === tri.k)!
  const lignes = prets.slice().sort((a, b) => {
    const x = col.v(a), y = col.v(b)
    const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr')
    return tri.asc ? r : -r
  })
  const N = 25
  const nbPages = Math.max(1, Math.ceil(lignes.length / N))
  const p0 = Math.min(page, nbPages - 1)
  const exporter = () =>
    telechargerCsv('prets-augustins.csv', [
      [...cols.map((c) => c.l), 'Dates incohérentes', 'Programmé', 'Latitude', 'Longitude', 'Distance Toulouse (km)'],
      ...lignes.map((p) => [...cols.map((c) => (c.k === 'jours' ? p.jours : c.v(p))), p.datesInversees ? 'oui' : '', p.programme ? 'oui' : '', p.lat, p.lon, p.km]),
    ])
  return (
    <section className="bloc">
      <div className="bloc-tete">
        <h2>Tous les prêts <small>({fmt(prets.length)})</small></h2>
        <button className="bouton" onClick={exporter}>Exporter en CSV</button>
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.k} aria-sort={tri.k === c.k ? (tri.asc ? 'ascending' : 'descending') : 'none'}>
                  <button onClick={() => setTri({ k: c.k, asc: tri.k === c.k ? !tri.asc : true })}>{c.l}{tri.k === c.k ? (tri.asc ? ' ↑' : ' ↓') : ''}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.slice(p0 * N, p0 * N + N).map((p) => (
              <tr key={p.id} className={p.datesInversees ? 'alerte-ligne' : ''}>
                <td>{dateFr(p.debut)}</td>
                <td>{dateFr(p.fin)}{p.datesInversees && ' ⚠'}</td>
                <td className="mono">{o(p).inv ?? '–'}</td>
                <td><button className="lien" onClick={() => ouvrir({ type: 'oeuvre', id: p.oeuvreId })}>{o(p).titre}</button></td>
                <td>{o(p).artiste}</td>
                <td><i className="pastille" style={{ background: COULEUR_DOMAINE[o(p).domaine] }} />{o(p).domaine}</td>
                <td>{p.expo}</td>
                <td>{p.musee}</td>
                <td>{p.ville}</td>
                <td>{p.pays}</td>
                <td className="num">{p.jours ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button disabled={p0 === 0} onClick={() => setPage(p0 - 1)}>← Précédent</button>
        <span>Page {p0 + 1} / {nbPages}</span>
        <button disabled={p0 >= nbPages - 1} onClick={() => setPage(p0 + 1)}>Suivant →</button>
      </div>
    </section>
  )
}
