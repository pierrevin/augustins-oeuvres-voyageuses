export type Domaine = 'Peinture' | 'Sculpture' | 'Arts graphiques' | 'Autre ou inconnu'
export const DOMAINES: Domaine[] = ['Peinture', 'Sculpture', 'Arts graphiques', 'Autre ou inconnu']

export interface Oeuvre {
  id: string
  inv: string | null
  titre: string
  variantesTitre: string[]
  artiste: string
  artisteId: string
  domaine: Domaine
  domaineBrut: string | null
  designation: string | null
  datation: string | null
  siecle: number | null
  technique: string | null
  matiere: string | null
  mesures: string | null
  acquisition: string | null
  anneeAcquisition: number | null
  proprietaire: string | null
  images: string[]
  credit: string | null
  source: 'inventaire' | 'depots' | 'absente'
  nbPrets: number
  joursHorsMurs: number
  kmParcourus: number
  pays: string[]
}

export interface Pret {
  id: number
  oeuvreId: string
  expo: string
  musee: string
  ville: string
  pays: string
  iso: string
  continent: string
  lat: number | null
  lon: number | null
  debut: string
  fin: string
  jours: number | null
  annee: number
  km: number | null
  datesInversees: boolean
  programme: boolean
}

export interface Artiste {
  id: string
  nom: string
  variantes: string[]
  nbPrets: number
  oeuvres: string[]
  nbOeuvresCollection: number
  pays: string[]
}

export type Gravite = 'bloquant' | 'important' | 'mineur' | 'info'

export interface Controle {
  id: string
  jeu: 'Prêts' | 'Inventaire' | 'Dépôts' | 'Croisement'
  titre: string
  nb: number
  total: number
  gravite: Gravite
  constat: string
  regle: string
  exemples: string[]
}

export interface Source {
  id: string
  titre: string
  url: string
  lignes: number
  champs: number
  champsVides: string[]
  modifie: string | null
  licence: string | null
  producteur: string | null
}

export interface BrutNet {
  indicateur: string
  brut: number
  net: number
  commentaire: string
}

export interface Payload {
  genereLe: string
  sources: Source[]
  oeuvres: Oeuvre[]
  prets: Pret[]
  artistes: Artiste[]
  collection: {
    domaines: { domaine: Domaine; total: number; pretees: number }[]
    totalInventaire: number
    totalDepots: number
    inventaireAvecImage: number
  }
  images: { urls: number; ok: number; repareesCasse: number; cassees: number; nonVerifiees: number; recupereesInventaire: number }
  controles: Controle[]
  brutVsNet: BrutNet[]
  villesNonGeocodees: string[]
}
