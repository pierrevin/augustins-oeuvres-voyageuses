import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Payload } from '../lib/types.js'
import { Fiche, FicheCtx, type Cible } from './components/Fiches'
import { Pro } from './tabs/Pro'
import { Public } from './tabs/Public'
import { Coulisses } from './tabs/Coulisses'
import { dateFr, indexer } from './util'

type Onglet = 'pro' | 'public' | 'coulisses'
const ONGLETS: { id: Onglet; label: string; sous: string }[] = [
  { id: 'public', label: 'Œuvres voyageuses', sous: 'Jouer et découvrir' },
  { id: 'pro', label: 'Tableau de bord', sous: 'Pour les équipes du musée' },
  { id: 'coulisses', label: 'Coulisses des données', sous: 'Méthode, nettoyage, limites' },
]
const ongletInitial = (): Onglet => {
  const h = location.hash.replace('#', '') as Onglet
  return ONGLETS.some((o) => o.id === h) ? h : 'public'
}

export default function App() {
  const [data, setData] = useState<Payload | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<Onglet>(ongletInitial)
  const [cible, setCible] = useState<Cible>(null)

  useEffect(() => {
    fetch('/api/data')
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j?.detail ?? r.statusText)
        return j as Payload
      })
      .then(setData)
      .catch((e) => setErreur(String(e.message ?? e)))
  }, [])
  useEffect(() => {
    const f = () => setOnglet(ongletInitial())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  const idx = useMemo(() => (data ? indexer(data) : null), [data])
  const fermer = useCallback(() => setCible(null), [])
  const choisir = (o: Onglet) => {
    history.replaceState(null, '', '#' + o)
    setOnglet(o)
    window.scrollTo({ top: 0 })
  }

  return (
    <FicheCtx.Provider value={setCible}>
      <header className="entete">
        <div className="entete-in">
          <div className="marque">
            <span className="marque-sur">Musée des Augustins · Toulouse</span>
            <span className="marque-titre">Les Augustins hors les murs</span>
          </div>
          <nav className="onglets" aria-label="Sections">
            {ONGLETS.map((o) => (
              <button key={o.id} className={'onglet' + (onglet === o.id ? ' actif' : '')} onClick={() => choisir(o.id)} aria-current={onglet === o.id}>
                <span>{o.label}</span>
                <small>{o.sous}</small>
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="page">
        {erreur && (
          <div className="alerte">
            <strong>Les données n’ont pas pu être chargées.</strong> La source Open Data Toulouse Métropole ne répond peut-être pas. Détail : {erreur}
          </div>
        )}
        {!data && !erreur && (
          <div className="chargement">
            <div className="sablier" />
            <p>Interrogation de l’Open Data Toulouse Métropole, nettoyage et croisement des trois jeux de données…</p>
            <p className="note">Premier chargement : une dizaine de secondes. Les suivants sont instantanés.</p>
          </div>
        )}
        {idx && onglet === 'pro' && <Pro idx={idx} />}
        {idx && onglet === 'public' && <Public idx={idx} />}
        {idx && onglet === 'coulisses' && <Coulisses idx={idx} />}
      </main>
      <footer className="pied">
        <div>
          Données : <a href="https://data.toulouse-metropole.fr/explore/dataset/prets-des-collections-du-musee-des-augustins/" target="_blank" rel="noreferrer">Mairie de Toulouse, Open Data Toulouse Métropole</a>, Licence Ouverte v2.0 (Etalab).
          {data && (
            <> Mise à jour des sources : prêts {dateFr(data.sources[0].modifie)}, inventaire {dateFr(data.sources[1].modifie)}, dépôts {dateFr(data.sources[2].modifie)}. Données recalculées le {dateFr(data.genereLe)}.</>
          )}
        </div>
        <div>
          Réalisation : Pierre Vincenot, <a href="https://immediatlab.fr" target="_blank" rel="noreferrer">Immédiat</a>, pour le cours de datavisualisation de l’EBD. <a href="https://github.com/pierrevin/augustins-oeuvres-voyageuses" target="_blank" rel="noreferrer">Code source</a>.
        </div>
      </footer>
      {idx && <Fiche cible={cible} idx={idx} fermer={fermer} />}
    </FicheCtx.Provider>
  )
}
