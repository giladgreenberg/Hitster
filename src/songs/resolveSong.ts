// הופך שיר מספוטיפיי ל-Song עם שנה מקורית אמינה – או מחזיר סיבה לדילוג.

import type { SpotifyTrack } from '../spotify/api'
import { getTrack } from '../spotify/api'
import { lookupOriginalYear } from './musicbrainz'
import { isSuspiciousTrack, parseYear } from './filters'
import type { Song } from './types'

export type ResolveResult = { ok: true; song: Song } | { ok: false; reason: string }

export async function resolveSong(track: SpotifyTrack): Promise<ResolveResult> {
  // שירים מפלייליסט/חיפוש לפעמים מגיעים בלי external_ids – אז שולפים את השיר המלא
  let t = track
  if (!t.external_ids) {
    try {
      t = await getTrack(track.id)
    } catch {
      /* נמשיך עם מה שיש */
    }
  }

  const spotifyYear = parseYear(t.album?.release_date)
  const isrc = t.external_ids?.isrc ?? null
  const mbYear = isrc ? await lookupOriginalYear(isrc) : null

  let year: number
  let yearSource: Song['yearSource']
  if (mbYear !== null) {
    // ספוטיפיי לא יכול להיות מוקדם מההוצאה המקורית, אז לוקחים את המינימום
    year = spotifyYear !== null ? Math.min(mbYear, spotifyYear) : mbYear
    yearSource = 'musicbrainz'
  } else {
    if (spotifyYear === null) return { ok: false, reason: 'אין שנה בכלל' }
    if (isSuspiciousTrack(t.name, t.album?.name ?? '')) {
      return { ok: false, reason: 'אין ב-MusicBrainz והשם מרמז על רימאסטר/אוסף/הופעה' }
    }
    if (t.album?.album_type === 'compilation') {
      return { ok: false, reason: 'אין ב-MusicBrainz והאלבום הוא אוסף' }
    }
    year = spotifyYear
    yearSource = 'spotify'
  }

  const images = t.album?.images ?? []
  return {
    ok: true,
    song: {
      id: t.id,
      uri: t.uri,
      name: t.name,
      artists: t.artists.map((a) => a.name).join(', '),
      album: t.album?.name ?? '',
      coverUrl: images[0]?.url ?? null,
      durationMs: t.duration_ms,
      isrc,
      spotifyYear,
      year,
      yearSource,
    },
  }
}
