export interface Song {
  id: string
  uri: string
  name: string
  artists: string
  album: string
  coverUrl: string | null
  albumUri: string | null
  durationMs: number
  isrc: string | null
  /** השנה לפי תאריך האלבום בספוטיפיי (עלולה להיות של רימאסטר/אוסף) */
  spotifyYear: number | null
  /** השנה שבה משתמשים במשחק */
  year: number
  yearSource: 'musicbrainz' | 'spotify'
  /** מספר ההוצאות ב-MusicBrainz (סימן לפופולריות; null = לא ידוע) */
  mbReleases?: number | null
  /** מה MusicBrainz ענה (לאבחון) */
  mbStatus: string
}
