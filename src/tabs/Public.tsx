import { useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { DOMAINES, type Domaine, type Oeuvre, type Pret } from '../../lib/types.js'
import { PAYS } from '../../lib/geo.js'
import { WorldMap } from '../components/WorldMap'
import { useFiche } from '../components/Fiches'
import { COULEUR_DOMAINE, Img, dateFr, fmt, melanger, moisAnnee, siecleRomain, stockage, type Index } from '../util'

type Section = 'jeu' | 'carnet' | 'explorer' | 'passeport'
interface Passeport { pays: string[]; oeuvres: string[]; meilleur: number; parties: number }
const [lirePasseport, ecrirePasseport] = stockage<Passeport>('augustins-passeport', { pays: [], oeuvres: [], meilleur: 0, parties: 0 })


export function Public({ idx }: { idx: Index }) {
  const [section, setSection] = useState<Section>('jeu')
  const [passeport, setPasseport] = useState<Passeport>(lirePasseport)
  const maj = (f: (p: Passeport) => Passeport) =>
    setPasseport((p) => {
      const n = f(p)
      ecrirePasseport(n)
      return n
    })
  const { data } = idx
  const km = d3.sum(data.oeuvres, (o) => o.kmParcourus)
  return (
    <div className="public">
      <section className="hero">
        <div className="hero-texte">
          <p className="surtitre">Musée des Augustins · {d3.min(data.prets, (p) => p.annee)}–{d3.max(data.prets, (p) => p.annee)}</p>
          <h1>Les œuvres voyageuses</h1>
          <p className="chapo">
            Le musée prête ses œuvres aux expositions du monde entier. {fmt(data.oeuvres.length)} œuvres sont parties {fmt(data.prets.length)} fois, dans {new Set(data.prets.map((p) => p.pays)).size} pays, et ont parcouru ensemble environ {fmt(Math.round(km / 1000) * 1000)} km à vol d’oiseau. Saurez-vous retrouver leurs destinations ?
          </p>
        </div>
        <Records idx={idx} />
      </section>
      <nav className="sous-nav" aria-label="Rubriques">
        {([['jeu', 'Où est-elle partie ?'], ['carnet', 'Carnets de voyage'], ['explorer', 'Explorer les œuvres'], ['passeport', `Mon passeport (${passeport.pays.length})`]] as [Section, string][]).map(([k, l]) => (
          <button key={k} className={section === k ? 'on' : ''} onClick={() => setSection(k)}>{l}</button>
        ))}
      </nav>
      {section === 'jeu' && <Jeu idx={idx} passeport={passeport} maj={maj} />}
      {section === 'carnet' && <Carnet idx={idx} />}
      {section === 'explorer' && <Explorer idx={idx} />}
      {section === 'passeport' && <PasseportVue idx={idx} passeport={passeport} maj={maj} />}
    </div>
  )
}

function Records({ idx }: { idx: Index }) {
  const ouvrir = useFiche()
  const o = idx.data.oeuvres
  const voyageuse = d3.greatest(o, (x) => x.kmParcourus)!
  const pretee = d3.greatest(o, (x) => x.nbPrets)!
  const loin = d3.greatest(idx.data.prets, (p) => p.km ?? 0)!
  const loinO = idx.oeuvre.get(loin.oeuvreId)!
  const artiste = idx.data.artistes[0]
  const cartes = [
    { t: 'La grande voyageuse', o: voyageuse, l: `${fmt(voyageuse.kmParcourus)} km parcourus`, f: () => ouvrir({ type: 'oeuvre', id: voyageuse.id }) },
    { t: 'La plus demandée', o: pretee, l: `${pretee.nbPrets} prêts`, f: () => ouvrir({ type: 'oeuvre', id: pretee.id }) },
    { t: 'Le plus lointain', o: loinO, l: `${loin.ville} (${loin.pays}), ${fmt(loin.km ?? 0)} km`, f: () => ouvrir({ type: 'oeuvre', id: loinO.id }) },
  ]
  return (
    <div className="records">
      {cartes.map((c) => (
        <button key={c.t} className="record" onClick={c.f}>
          <Img srcs={c.o.images} alt={c.o.titre} />
          <span className="record-t">{c.t}</span>
          <strong>{c.o.titre}</strong>
          <small>{c.o.artiste} · {c.l}</small>
        </button>
      ))}
      <button className="record texte" onClick={() => ouvrir({ type: 'artiste', id: artiste.id })}>
        <span className="record-t">L’artiste star</span>
        <strong>{artiste.nom}</strong>
        <small>{artiste.nbPrets} prêts de {artiste.oeuvres.length} œuvres, dans {artiste.pays.length} pays</small>
      </button>
    </div>
  )
}

// ---------- Jeu ----------
interface Question { pret: Pret; oeuvre: Oeuvre; choix: string[] }
const TOURS = 10

function Jeu({ idx, passeport, maj }: { idx: Index; passeport: Passeport; maj: (f: (p: Passeport) => Passeport) => void }) {
  const ouvrir = useFiche()
  const candidats = useMemo(() => idx.data.prets.filter((p) => p.lat !== null && idx.oeuvre.get(p.oeuvreId)!.images.length > 0), [idx])
  const villes = useMemo(() => [...new Set(idx.data.prets.map((p) => `${p.ville} (${p.pays})`))], [idx])
  const nouvelle = (): Question => {
    // Une question sur deux porte sur un prêt à l'étranger, sinon la France écraserait tout.
    const etranger = Math.random() < 0.5
    const pool = candidats.filter((p) => (etranger ? p.pays !== 'France' : p.pays === 'France'))
    const pret = pool[Math.floor(Math.random() * pool.length)]
    const bonne = `${pret.ville} (${pret.pays})`
    const autres = melanger(villes.filter((v) => v !== bonne && v !== 'Toulouse (France)')).slice(0, 3)
    return { pret, oeuvre: idx.oeuvre.get(pret.oeuvreId)!, choix: melanger([bonne, ...autres]) }
  }
  const [q, setQ] = useState<Question>(nouvelle)
  const [reponse, setReponse] = useState<string | null>(null)
  const [indice, setIndice] = useState(false)
  const [score, setScore] = useState(0)
  const [tour, setTour] = useState(1)
  const [fini, setFini] = useState(false)
  const bonne = `${q.pret.ville} (${q.pret.pays})`

  const repondre = (c: string) => {
    if (reponse) return
    setReponse(c)
    if (c === bonne) {
      setScore((s) => s + (indice ? 5 : 10))
      maj((p) => ({ ...p, pays: [...new Set([...p.pays, q.pret.pays])], oeuvres: [...new Set([...p.oeuvres, q.oeuvre.id])] }))
    }
  }
  const suivante = () => {
    if (tour >= TOURS) {
      setFini(true)
      maj((p) => ({ ...p, meilleur: Math.max(p.meilleur, score), parties: p.parties + 1 }))
      return
    }
    setTour(tour + 1); setQ(nouvelle()); setReponse(null); setIndice(false)
  }
  const rejouer = () => { setScore(0); setTour(1); setFini(false); setQ(nouvelle()); setReponse(null); setIndice(false) }

  if (fini)
    return (
      <section className="bloc jeu-fin">
        <h2>{score >= 80 ? 'Commissaire d’exposition confirmé !' : score >= 50 ? 'Belle tournée !' : 'Les œuvres gardent leurs secrets…'}</h2>
        <p className="score-geant">{score} <small>/ {TOURS * 10}</small></p>
        <p>Meilleur score : {Math.max(passeport.meilleur, score)} · {passeport.pays.length} pays tamponnés sur votre passeport.</p>
        <button className="bouton grand" onClick={rejouer}>Rejouer</button>
      </section>
    )

  const juste = reponse === bonne
  return (
    <section className="bloc jeu">
      <div className="jeu-tete">
        <span>Question {tour} / {TOURS}</span>
        <span className="jeu-score">{score} points</span>
      </div>
      <div className="jeu-grille">
        <div className="jeu-oeuvre">
          <Img srcs={q.oeuvre.images} alt={q.oeuvre.titre} className="jeu-img" eager />
          {q.oeuvre.credit && <p className="credit">{q.oeuvre.credit}</p>}
        </div>
        <div className="jeu-question">
          <p className="surtitre" style={{ color: COULEUR_DOMAINE[q.oeuvre.domaine] }}>{q.oeuvre.domaine}{q.oeuvre.siecle ? ' · ' + siecleRomain(q.oeuvre.siecle) : ''}</p>
          <h2>{q.oeuvre.titre}</h2>
          <p className="jeu-artiste">{q.oeuvre.artiste}</p>
          <p className="jeu-consigne">En {moisAnnee(q.pret.debut)}, cette œuvre a quitté Toulouse pour une exposition. <strong>Où est-elle partie ?</strong></p>
          <div className="choix">
            {q.choix.map((c) => (
              <button key={c} onClick={() => repondre(c)} disabled={!!reponse} className={reponse ? (c === bonne ? 'juste' : c === reponse ? 'faux' : 'eteint') : ''}>
                {c}
              </button>
            ))}
          </div>
          {!reponse && !indice && <button className="lien" onClick={() => setIndice(true)}>Un indice ? (la bonne réponse ne rapportera que 5 points)</button>}
          {!reponse && indice && <p className="indice">Titre de l’exposition : « {q.pret.expo} »</p>}
          {reponse && (
            <div className={'verdict ' + (juste ? 'ok' : 'ko')}>
              <strong>{juste ? `Bravo ! +${indice ? 5 : 10} points, tampon « ${q.pret.pays} » ajouté.` : `Raté : elle est partie à ${bonne}.`}</strong>
              <p>Exposition « {q.pret.expo} », {q.pret.musee}, du {dateFr(q.pret.debut)} au {dateFr(q.pret.fin)}. {q.pret.km ? `${fmt(q.pret.km)} km depuis Toulouse.` : ''}</p>
              {q.oeuvre.nbPrets > 1 && <p>Cette œuvre a voyagé {q.oeuvre.nbPrets} fois, dans {q.oeuvre.pays.length} pays.</p>}
              <div className="verdict-actions">
                <button className="bouton" onClick={suivante}>{tour >= TOURS ? 'Voir mon score' : 'Question suivante →'}</button>
                <button className="lien" onClick={() => ouvrir({ type: 'oeuvre', id: q.oeuvre.id })}>Découvrir l’œuvre</button>
                <button className="lien" onClick={() => ouvrir({ type: 'artiste', id: q.oeuvre.artisteId })}>Découvrir {q.oeuvre.artiste}</button>
              </div>
            </div>
          )}
        </div>
        {reponse && q.pret.lat !== null && (
          <div className="jeu-carte">
            <WorldMap vue="auto" hauteur={420} trajets={[{ lat: q.pret.lat, lon: q.pret.lon!, etat: 'actif', label: q.pret.ville }]} />
          </div>
        )}
      </div>
    </section>
  )
}

// ---------- Carnets de voyage ----------
function Carnet({ idx }: { idx: Index }) {
  const ouvrir = useFiche()
  const voyageuses = useMemo(() => idx.data.oeuvres.filter((o) => o.images.length && o.nbPrets >= 3).sort((a, b) => b.kmParcourus - a.kmParcourus), [idx])
  const [id, setId] = useState(voyageuses[0]?.id)
  const [etape, setEtape] = useState(0)
  const [lecture, setLecture] = useState(true)
  const o = idx.oeuvre.get(id!)!
  const prets = (idx.pretsParOeuvre.get(o.id) ?? []).filter((p) => p.lat !== null)
  useEffect(() => { setEtape(0); setLecture(true) }, [id])
  useEffect(() => {
    if (!lecture) return
    if (etape >= prets.length) { setLecture(false); return }
    const t = setTimeout(() => setEtape((e) => e + 1), etape === 0 ? 500 : 1400)
    return () => clearTimeout(t)
  }, [lecture, etape, prets.length])
  const km = d3.sum(prets.slice(0, etape), (p) => 2 * (p.km ?? 0))
  const tirer = () => setId(voyageuses[Math.floor(Math.random() * voyageuses.length)].id)
  return (
    <section className="bloc carnet">
      <div className="carnet-tete">
        <div>
          <h2>Carnets de voyage</h2>
          <p className="sous">Suivez une œuvre d’exposition en exposition. Chaque trait part de Toulouse : entre deux prêts, l’œuvre rentre au musée.</p>
        </div>
        <div className="carnet-actions">
          <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Choisir une œuvre">
            {voyageuses.map((v) => <option key={v.id} value={v.id}>{v.titre} ({v.artiste})</option>)}
          </select>
          <button className="bouton" onClick={tirer}>Au hasard</button>
        </div>
      </div>
      <div className="carnet-grille">
        <div className="carnet-oeuvre">
          <Img srcs={o.images} alt={o.titre} className="carnet-img" eager />
          <h3>{o.titre}</h3>
          <p>{o.artiste}{o.datation ? `, ${o.datation}` : ''}</p>
          <div className="compteur">
            <strong>{fmt(km)}</strong><span>km parcourus</span>
            <strong>{Math.min(etape, prets.length)} / {prets.length}</strong><span>voyages</span>
          </div>
          <div className="carnet-boutons">
            <button className="bouton" onClick={() => { setEtape(0); setLecture(true) }}>↻ Rejouer le voyage</button>
            <button className="lien" onClick={() => ouvrir({ type: 'oeuvre', id: o.id })}>Fiche complète</button>
          </div>
        </div>
        <div className="carnet-carte">
          <WorldMap
            vue="auto"
            hauteur={520}
            rMax={0}
            trajets={prets.map((p, i) => ({ lat: p.lat!, lon: p.lon!, etat: i < etape - 1 ? 'fait' : i === etape - 1 ? 'actif' : 'futur', label: p.ville }))}
          />
          <ol className="etapes">
            {prets.map((p, i) => (
              <li key={p.id} className={i < etape - 1 ? 'fait' : i === etape - 1 ? 'actif' : 'futur'}>
                <button onClick={() => { setLecture(false); setEtape(i + 1) }}>
                  <span className="et-an">{p.debut.slice(0, 4)}</span>
                  <span className="et-lieu">{p.ville} <small>({p.pays})</small></span>
                  <span className="et-expo">« {p.expo} »</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

// ---------- Explorer ----------
function Explorer({ idx }: { idx: Index }) {
  const ouvrir = useFiche()
  const [domaine, setDomaine] = useState<Domaine | 'tous'>('tous')
  const [siecle, setSiecle] = useState<string>('tous')
  const [pays, setPays] = useState('tous')
  const [q, setQ] = useState('')
  const [tri, setTri] = useState<'prets' | 'km' | 'titre' | 'date'>('prets')
  const [imagesSeules, setImagesSeules] = useState(true)
  const [n, setN] = useState(48)
  const siecles = [...new Set(idx.data.oeuvres.map((o) => o.siecle).filter(Boolean) as number[])].sort((a, b) => a - b)
  const listePays = [...new Set(idx.data.prets.map((p) => p.pays))].sort((a, b) => a.localeCompare(b, 'fr'))
  const liste = idx.data.oeuvres
    .filter((o) =>
      (domaine === 'tous' || o.domaine === domaine) &&
      (siecle === 'tous' || String(o.siecle) === siecle) &&
      (pays === 'tous' || o.pays.includes(pays)) &&
      (!imagesSeules || o.images.length > 0) &&
      (!q || `${o.titre} ${o.artiste}`.toLowerCase().includes(q.toLowerCase())),
    )
    .sort((a, b) =>
      tri === 'prets' ? b.nbPrets - a.nbPrets : tri === 'km' ? b.kmParcourus - a.kmParcourus : tri === 'titre' ? a.titre.localeCompare(b.titre, 'fr') : (a.siecle ?? 99) - (b.siecle ?? 99),
    )
  return (
    <section className="bloc">
      <h2>Explorer les œuvres</h2>
      <div className="filtres">
        <input type="search" placeholder="Titre ou artiste…" value={q} onChange={(e) => { setQ(e.target.value); setN(48) }} />
        <select value={domaine} onChange={(e) => setDomaine(e.target.value as Domaine)} aria-label="Domaine">
          <option value="tous">Tous les domaines</option>
          {DOMAINES.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={siecle} onChange={(e) => setSiecle(e.target.value)} aria-label="Siècle">
          <option value="tous">Tous les siècles</option>
          {siecles.map((s) => <option key={s} value={s}>{siecleRomain(s)}</option>)}
        </select>
        <select value={pays} onChange={(e) => setPays(e.target.value)} aria-label="Destination">
          <option value="tous">Toutes les destinations</option>
          {listePays.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={tri} onChange={(e) => setTri(e.target.value as typeof tri)} aria-label="Tri">
          <option value="prets">Les plus prêtées</option>
          <option value="km">Les plus voyageuses</option>
          <option value="date">Par siècle</option>
          <option value="titre">Par titre</option>
        </select>
        <label className="case"><input type="checkbox" checked={imagesSeules} onChange={(e) => setImagesSeules(e.target.checked)} /> Avec image</label>
      </div>
      <p className="sous">{liste.length} œuvre{liste.length > 1 ? 's' : ''}</p>
      <div className="galerie">
        {liste.slice(0, n).map((o) => (
          <button key={o.id} className="carte-oeuvre" onClick={() => ouvrir({ type: 'oeuvre', id: o.id })}>
            <Img srcs={o.images} alt={o.titre} />
            <span className="co-titre">{o.titre}</span>
            <span className="co-artiste">{o.artiste}</span>
            <span className="co-meta"><i className="pastille" style={{ background: COULEUR_DOMAINE[o.domaine] }} />{o.nbPrets} prêt{o.nbPrets > 1 ? 's' : ''} · {o.pays.length} pays</span>
          </button>
        ))}
      </div>
      {n < liste.length && <button className="bouton centre" onClick={() => setN(n + 48)}>Voir plus d’œuvres</button>}
    </section>
  )
}

// ---------- Passeport ----------
function PasseportVue({ idx, passeport, maj }: { idx: Index; passeport: Passeport; maj: (f: (p: Passeport) => Passeport) => void }) {
  const ouvrir = useFiche()
  const tous = [...new Set(idx.data.prets.map((p) => p.pays))].sort((a, b) => a.localeCompare(b, 'fr'))
  const nbParPays = d3.rollup(idx.data.prets, (v) => v.length, (p) => p.pays)
  const obtenus = new Set(passeport.pays)
  return (
    <section className="bloc">
      <h2>Mon passeport</h2>
      <p className="sous">Chaque bonne réponse au jeu tamponne le pays de destination et ajoute l’œuvre à votre musée. Progression enregistrée dans ce navigateur.</p>
      <div className="tampons">
        {tous.map((p) => (
          <div key={p} className={'tampon' + (obtenus.has(p) ? ' on' : '')}>
            <span className="tampon-iso">{PAYS[p]?.iso ?? '?'}</span>
            <span className="tampon-nom">{p}</span>
            <small>{nbParPays.get(p)} prêt{(nbParPays.get(p) ?? 0) > 1 ? 's' : ''}</small>
          </div>
        ))}
      </div>
      <p><strong>{obtenus.size} / {tous.length}</strong> pays · meilleur score {passeport.meilleur} · {passeport.parties} partie{passeport.parties > 1 ? 's' : ''}</p>
      <WorldMap vue="monde" hauteur={420} paysMarques={passeport.pays.map((p) => PAYS[p]?.num).filter(Boolean) as string[]} />
      <h3>Mon musée <small>({passeport.oeuvres.length} œuvres rencontrées)</small></h3>
      {passeport.oeuvres.length === 0 ? (
        <p className="note">Jouez à « Où est-elle partie ? » pour commencer votre collection.</p>
      ) : (
        <div className="galerie petite">
          {passeport.oeuvres.map((id) => idx.oeuvre.get(id)).filter(Boolean).map((o) => (
            <button key={o!.id} className="carte-oeuvre" onClick={() => ouvrir({ type: 'oeuvre', id: o!.id })}>
              <Img srcs={o!.images} alt={o!.titre} />
              <span className="co-titre">{o!.titre}</span>
              <span className="co-artiste">{o!.artiste}</span>
            </button>
          ))}
        </div>
      )}
      {(passeport.pays.length > 0 || passeport.oeuvres.length > 0) && (
        <button className="lien" onClick={() => maj(() => ({ pays: [], oeuvres: [], meilleur: 0, parties: 0 }))}>Remettre le passeport à zéro</button>
      )}
    </section>
  )
}
