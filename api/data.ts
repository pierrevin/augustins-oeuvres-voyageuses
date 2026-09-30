// Fonction serverless Vercel : GET /api/data
// Interroge l'API Open Data Toulouse Métropole, nettoie, joint, audite, renvoie un JSON unique.
// Mis en cache 24 h sur le CDN de Vercel : pas de base de données.
import { construire } from '../lib/pipeline.js'

const fetchJson = async (url: string) => {
  const r = await fetch(url, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`${r.status} sur ${url}`)
  return r.json()
}

const checkUrl = async (url: string): Promise<boolean | null> => {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    let r = await fetch(url, { method: 'HEAD', signal: ctrl.signal })
    if (r.status === 405) r = await fetch(url, { headers: { range: 'bytes=0-0' }, signal: ctrl.signal })
    clearTimeout(t)
    if (r.ok || r.status === 206) return true
    if (r.status === 404 || r.status === 403 || r.status === 410) return false
    return null
  } catch {
    return null
  }
}

export default async function handler(_req: any, res: any) {
  try {
    const payload = await construire(fetchJson, checkUrl)
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.status(200).send(JSON.stringify(payload))
  } catch (e: any) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(502).json({ erreur: 'Source de données indisponible', detail: String(e?.message ?? e) })
  }
}

export const config = { maxDuration: 60 }
