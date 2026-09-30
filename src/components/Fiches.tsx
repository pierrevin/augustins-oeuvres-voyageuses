import { createContext, useContext, useEffect } from 'react'
import { WorldMap, type Vue } from './WorldMap'
import { COULEUR_DOMAINE, Img, dateFr, fmt, siecleRomain, type Index } from '../util'

export type Cible = { type: 'oeuvre' | 'artiste'; id: string } | null
export const FicheCtx = createContext<(c: Cible) => void>(() => {})
export const useFiche = () => useContext(FicheCtx)

export function Fiche({ cible, idx, fermer }: { cible: Cible; idx: Index; fermer: () => void }) {
  const ouvrir = useFiche()
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && fermer()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [fermer])
  if (!cible) return null
  return (
    <div className="modale-fond" onClick={fermer}>
      <div className="modale" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modale-fermer" onClick={fermer} aria-label="Fermer">×</button>
        {cible.type === 'oeuvre' ? <FicheOeuvre id={cible.id} idx={idx} ouvrir={ouvrir} /> : <FicheArtiste id={cible.id} idx={idx} ouvrir={ouvrir} />}
      </div>
    </div>
  )
}

function vueAdaptee(pays: string[]): Vue {
  if (pays.every((p) => p === 'France')) return 'france'
  const europe = ['France', 'Allemagne', 'Espagne', 'Italie', 'Suisse', 'Belgique', 'Pays-Bas', 'Autriche', 'Angleterre', 'Hongrie', 'Pologne', 'Suède', 'Danemark', 'Luxembourg', 'Andorre', 'Roumanie']
  return pays.every((p) => europe.includes(p)) ? 'europe' : 'monde'
}

function FicheOeuvre({ id, idx, ouvrir }: { id: string; idx: Index; ouvrir: (c: Cible) => void }) {
  const o = idx.oeuvre.get(id)
  if (!o) return <p>Œuvre introuvable.</p>
  const prets = idx.pretsParOeuvre.get(id) ?? []
  const geo = prets.filter((p) => p.lat !== null)
  const lignes: [string, string | null][] = [
    ['Datation', o.datation],
    ['Domaine', o.domaineBrut ?? o.domaine],
    ['Désignation', o.designation],
    ['Technique', o.technique],
    ['Matière', o.matiere],
    ['Dimensions', o.mesures],
    ['Entrée au musée', [o.acquisition, o.anneeAcquisition].filter(Boolean).join(', ') || null],
    ['Propriétaire', o.proprietaire],
    ['N° d’inventaire', o.inv],
  ]
  return (
    <div className="fiche">
      <div className="fiche-visuel">
        <Img srcs={o.images} alt={o.titre} className="fiche-img" />
        {o.credit && <p className="credit">{o.credit}</p>}
      </div>
      <div className="fiche-texte">
        <p className="surtitre" style={{ color: COULEUR_DOMAINE[o.domaine] }}>{o.domaine}</p>
        <h2>{o.titre}</h2>
        <button className="lien-artiste" onClick={() => ouvrir({ type: 'artiste', id: o.artisteId })}>{o.artiste} →</button>
        <div className="fiche-chiffres">
          <div><strong>{o.nbPrets}</strong><span>prêt{o.nbPrets > 1 ? 's' : ''}</span></div>
          <div><strong>{fmt(o.joursHorsMurs)}</strong><span>jours hors les murs</span></div>
          <div><strong>{fmt(o.kmParcourus)}</strong><span>km (aller-retour, à vol d’oiseau)</span></div>
        </div>
        <dl className="fiche-dl">
          {lignes.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        {o.source === 'absente' && <p className="note">Cette œuvre n’a pas été retrouvée dans l’inventaire ni dans le registre des dépôts : seules les informations du jeu de prêts sont disponibles.</p>}
        {o.variantesTitre.length > 0 && <p className="note">Aussi intitulée : {o.variantesTitre.map((t) => `« ${t} »`).join(', ')}</p>}
      </div>
      <div className="fiche-voyages">
        <h3>Ses voyages</h3>
        {geo.length > 0 && <WorldMap vue={vueAdaptee(geo.map((p) => p.pays))} hauteur={400} trajets={geo.map((p) => ({ lat: p.lat!, lon: p.lon!, etat: 'fait' }))} rMax={0} />}
        <ol className="itineraire">
          {prets.map((p) => (
            <li key={p.id}>
              <span className="itin-date">{dateFr(p.debut)} → {p.datesInversees ? <em title="Date de fin antérieure au début dans la source">{dateFr(p.fin)} ⚠</em> : dateFr(p.fin)}</span>
              <span className="itin-lieu">{p.ville} <small>({p.pays})</small></span>
              <span className="itin-expo">« {p.expo} », {p.musee}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function FicheArtiste({ id, idx, ouvrir }: { id: string; idx: Index; ouvrir: (c: Cible) => void }) {
  const a = idx.data.artistes.find((x) => x.id === id)
  if (!a) return <p>Artiste introuvable.</p>
  const oeuvres = a.oeuvres.map((o) => idx.oeuvre.get(o)!).filter(Boolean)
  const siecles = [...new Set(oeuvres.map((o) => o.siecle).filter(Boolean))] as number[]
  return (
    <div className="fiche-artiste">
      <p className="surtitre">Artiste</p>
      <h2>{a.nom}</h2>
      {a.variantes.length > 0 && <p className="note">Aussi écrit : {a.variantes.join(', ')}</p>}
      <div className="fiche-chiffres">
        <div><strong>{a.oeuvres.length}</strong><span>œuvre{a.oeuvres.length > 1 ? 's' : ''} prêtée{a.oeuvres.length > 1 ? 's' : ''}</span></div>
        <div><strong>{a.nbPrets}</strong><span>prêts</span></div>
        <div><strong>{a.pays.length}</strong><span>pays visité{a.pays.length > 1 ? 's' : ''}</span></div>
        {a.nbOeuvresCollection > 0 && <div><strong>{a.nbOeuvresCollection}</strong><span>œuvres dans l’inventaire</span></div>}
      </div>
      <p>
        {siecles.length > 0 && <>Œuvres datées du {siecles.sort((x, y) => x - y).map(siecleRomain).join(', du ')}. </>}
        Destinations : {a.pays.join(', ')}.
      </p>
      <p>
        <a href={`https://fr.wikipedia.org/w/index.php?search=${encodeURIComponent(a.nom)}`} target="_blank" rel="noreferrer">Chercher « {a.nom} » sur Wikipédia ↗</a>
      </p>
      <div className="galerie petite">
        {oeuvres.map((o) => (
          <button key={o.id} className="carte-oeuvre" onClick={() => ouvrir({ type: 'oeuvre', id: o.id })}>
            <Img srcs={o.images} alt={o.titre} />
            <span className="co-titre">{o.titre}</span>
            <span className="co-meta">{o.nbPrets} prêt{o.nbPrets > 1 ? 's' : ''}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
