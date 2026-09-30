import { useState } from 'react'
import type { Controle, Gravite } from '../../lib/types.js'
import { dateFr, fmt, pct, type Index } from '../util'

const GRAVITE: Record<Gravite, { l: string; d: string }> = {
  bloquant: { l: 'Bloquant', d: 'fausse les chiffres si on ne corrige pas' },
  important: { l: 'Important', d: 'perte d’information ou erreurs visibles' },
  mineur: { l: 'Mineur', d: 'hétérogénéité de saisie' },
  info: { l: 'À savoir', d: 'pas une erreur, mais à connaître' },
}

export function Coulisses({ idx }: { idx: Index }) {
  const { data } = idx
  const [brut, setBrut] = useState(false)
  const [jeu, setJeu] = useState<'tous' | Controle['jeu']>('tous')
  const c = (id: string) => data.controles.find((x) => x.id === id)
  const nbPrets = data.sources[0].lignes
  const appar = data.brutVsNet.find((b) => b.indicateur.startsWith('Œuvres reliées'))
  const oeuvresPretees = new Set(data.prets.map((p) => p.oeuvreId)).size
  const controles = data.controles.filter((x) => jeu === 'tous' || x.jeu === jeu)

  return (
    <div className="coulisses">
      <section className="intro-coulisses">
        <p className="surtitre">Pour les étudiants et les curieux</p>
        <h1>Dans les coulisses des données</h1>
        <p className="chapo">
          Un tableau de bord n’est jamais plus fiable que les données qui l’alimentent. Avant de dessiner le moindre graphique, il a fallu comprendre trois jeux de données, les nettoyer et les relier. Cette page raconte ce travail, invisible dans les deux autres onglets. Tous les chiffres ci-dessous sont recalculés automatiquement à chaque mise à jour des sources.
        </p>
      </section>

      <section className="bloc">
        <h2>1. Les sources</h2>
        <div className="sources">
          {data.sources.map((s) => (
            <a key={s.id} className="source" href={s.url} target="_blank" rel="noreferrer">
              <strong>{s.titre}</strong>
              <span>{fmt(s.lignes)} lignes · {s.champs} colonnes{s.champsVides.length ? ` (dont ${s.champsVides.length} vides)` : ''}</span>
              <span>Mise à jour : {dateFr(s.modifie)}</span>
              <span>{s.producteur} · {s.licence}</span>
              <span className="source-lien">Voir sur data.toulouse-metropole.fr ↗</span>
            </a>
          ))}
        </div>
        <p className="note">
          Le jeu de prêts s’intitule « Vingt-cinq ans de prêts » et promet des mises à jour régulières. Dernière mise à jour : {dateFr(data.sources[0].modifie)}. L’inventaire n’a pas bougé depuis le {dateFr(data.sources[1].modifie)}. Le site suit l’API, mais il ne sera jamais plus frais qu’elle.
        </p>
      </section>

      <section className="bloc">
        <h2>2. La méthode</h2>
        <ol className="chaine">
          <li><strong>Collecter</strong><span>Appel de l’API Explore v2.1 d’Opendatasoft : export complet des 3 jeux, sans copie locale.</span></li>
          <li><strong>Nettoyer</strong><span>Espaces invisibles, casse, apostrophes, traits d’union, fautes de lieux, dates inversées.</span></li>
          <li><strong>Relier</strong><span>Jointure sur le numéro d’inventaire normalisé : inventaire d’abord, registre des dépôts ensuite.</span></li>
          <li><strong>Enrichir</strong><span>Géocodage des {new Set(data.prets.map((p) => p.ville + p.pays)).size} villes (fait une fois, contrôlé à la main), distances depuis Toulouse, siècle déduit de la datation.</span></li>
          <li><strong>Vérifier</strong><span>Test de chacune des {data.images.urls} adresses d’images, contrôles de cohérence listés plus bas.</span></li>
          <li><strong>Publier</strong><span>Un seul fichier JSON servi par une fonction Vercel, en cache 24 h. Pas de base de données.</span></li>
        </ol>
        <p className="note">Le code du nettoyage est lisible et commenté : <a href="https://github.com/pierrevin/augustins-oeuvres-voyageuses/blob/main/lib/pipeline.ts" target="_blank" rel="noreferrer">lib/pipeline.ts</a>. Chaque règle de cette page y correspond à quelques lignes.</p>
      </section>

      <section className="bloc">
        <h2>3. Le verdict</h2>
        <div className="verdicts">
          <div className="verdict-carte bon">
            <span className="verdict-note">Plutôt propre</span>
            <h3>Prêts</h3>
            <p>Structure simple et régulière, pays et dates bien formés, aucun doublon exact. Mais {c('espaces-invisibles')?.nb ?? 0} numéros d’inventaire piégés par des espaces invisibles, {c('dates-inversees')?.nb ?? 0} dates inversées, {c('lieux')?.nb ?? 0} prêts mal localisés et {pct(data.images.cassees + data.images.repareesCasse, data.images.urls)} % de liens d’images défaillants. Utilisable après une demi-douzaine de règles.</p>
          </div>
          <div className="verdict-carte moyen">
            <span className="verdict-note">Exploitable, pas analysable tel quel</span>
            <h3>Inventaire</h3>
            <p>Riche ({data.sources[1].champs} colonnes), mais c’est l’export d’une base de gestion, pas un jeu pensé pour l’analyse : datation en texte libre ({c('datation')?.nb ?? '?'} formats), dimensions et prix en texte, {pct(c('premier-janvier')?.nb ?? 0, c('premier-janvier')?.total ?? 1)} % de dates au 1er janvier, colonnes vides.</p>
          </div>
          <div className="verdict-carte moyen">
            <span className="verdict-note">Fragile sans normalisation</span>
            <h3>Croisement</h3>
            <p>Les deux jeux ne partagent qu’une clé fiable : le numéro d’inventaire. Comparé tel quel, il ne relie que {appar?.brut} œuvres sur {c('appariement')?.total ?? oeuvresPretees}. Normalisé, et avec le registre des dépôts, {appar?.net}. Les auteurs et les titres ne sont pas écrits de la même façon d’un jeu à l’autre.</p>
          </div>
        </div>
      </section>

      <section className="bloc">
        <div className="bloc-tete">
          <h2>4. Ce que change le nettoyage</h2>
          <div className="segment">
            <button className={brut ? 'on' : ''} onClick={() => setBrut(true)}>Données brutes</button>
            <button className={!brut ? 'on' : ''} onClick={() => setBrut(false)}>Données nettoyées</button>
          </div>
        </div>
        <p className="sous">Basculez pour voir les chiffres qu’on aurait publiés sans nettoyage.</p>
        <div className="brutnet">
          {data.brutVsNet.map((b) => {
            const ecart = b.net - b.brut
            return (
              <div key={b.indicateur} className={'bn' + (brut ? ' brut' : '')}>
                <span className="bn-l">{b.indicateur}</span>
                <strong>{fmt(brut ? b.brut : b.net)}</strong>
                <span className={'bn-ecart' + (ecart === 0 ? ' nul' : '')}>
                  {ecart === 0 ? 'identique' : brut ? `nettoyé : ${fmt(b.net)}` : `brut : ${fmt(b.brut)} (${ecart > 0 ? '+' : ''}${fmt(ecart)})`}
                </span>
                <small>{b.commentaire}</small>
              </div>
            )
          })}
        </div>
      </section>

      <section className="bloc">
        <div className="bloc-tete">
          <h2>5. Les incohérences, une par une <small>({data.controles.length})</small></h2>
          <div className="segment">
            {(['tous', 'Prêts', 'Inventaire', 'Croisement'] as const).map((j) => (
              <button key={j} className={jeu === j ? 'on' : ''} onClick={() => setJeu(j)}>{j === 'tous' ? 'Tout' : j}</button>
            ))}
          </div>
        </div>
        <div className="controles">
          {controles.map((x) => (
            <details key={x.id} className={'controle g-' + x.gravite}>
              <summary>
                <span className="ctl-gravite" title={GRAVITE[x.gravite].d}>{GRAVITE[x.gravite].l}</span>
                <span className="ctl-titre">{x.titre}</span>
                <span className="ctl-jeu">{x.jeu}</span>
                <span className="ctl-nb">{fmt(x.nb)} <small>{x.unite ?? `/ ${fmt(x.total)}`}</small></span>
              </summary>
              <div className="ctl-corps">
                <p>{x.constat}</p>
                <p><strong>Règle appliquée :</strong> {x.regle}</p>
                {x.exemples.length > 0 && (
                  <>
                    <p className="ctl-ex-t">Exemples tirés des données :</p>
                    <ul className="ctl-ex">{x.exemples.map((e) => <li key={e}>{e}</li>)}</ul>
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
        <p className="note">Échelle de gravité : {Object.values(GRAVITE).map((g) => `${g.l.toLowerCase()} (${g.d})`).join(', ')}.</p>
      </section>

      <section className="bloc">
        <h2>6. Les limites</h2>
        <ul className="limites">
          <li><strong>On ne voit que les prêts enregistrés.</strong> Ni les demandes refusées, ni les valeurs d’assurance, ni les coûts de transport. Impossible de mesurer ce que les prêts rapportent ou coûtent au musée.</li>
          <li><strong>La couverture est floue.</strong> La description parle de prêts « sollicités et obtenus », sans préciser si tous les prêts de la période sont là. Les années creuses sont-elles réelles ou des trous dans la saisie ?</li>
          <li><strong>Les distances sont théoriques.</strong> Calculées à vol d’oiseau, aller-retour depuis Toulouse, en supposant un retour au musée entre deux prêts. Les tournées d’exposition (plusieurs villes d’affilée) sont donc mal représentées.</li>
          <li><strong>Les images ne couvrent pas tout.</strong> Seules les œuvres du domaine public ont une photo, et certains liens sont cassés : {data.oeuvres.filter((o) => !o.images.length).length} œuvres prêtées restent sans image.</li>
          <li><strong>Le géocodage et les regroupements sont nos choix.</strong> Une ville, un nom de musée, une graphie d’artiste : chaque correction est documentée, mais c’est une interprétation. En cas de doute, seul le musée peut trancher.</li>
          <li><strong>Les prêts {c('programmes') ? `postérieurs au ${dateFr(data.sources[0].modifie)}` : 'récents'} sont des prévisions.</strong> Rien ne garantit qu’ils ont eu lieu comme prévu.</li>
        </ul>
      </section>

      <section className="bloc a-vous">
        <h2>À vous de jouer</h2>
        <ol>
          <li>Téléchargez le jeu de prêts en CSV et cherchez vous-même les dates inversées. Combien de temps vous a-t-il fallu, avec un tableur ? avec une IA ?</li>
          <li>Ouvrez les numéros d’inventaire dans un éditeur de texte. Voyez-vous les espaces insécables ? Comment les rendre visibles ?</li>
          <li>Faites un tableau croisé dynamique « prêts par musée ». Combien de musées apparaissent en double à cause d’une majuscule ?</li>
          <li>La part du fonds prêtée varie fortement selon le domaine. Formulez deux hypothèses, et dites quelles données il faudrait pour les vérifier.</li>
          <li>Proposez au musée trois règles de saisie qui éviteraient la moitié de ces corrections.</li>
        </ol>
        <p className="note">Nombre total de prêts analysés : {fmt(nbPrets)}.</p>
      </section>
    </div>
  )
}
