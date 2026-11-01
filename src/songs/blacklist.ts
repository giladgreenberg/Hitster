// שירים שסומנו "השנה שגויה" – לא יופיעו שוב.
const KEY = 'hitster.blacklist.v1'

export function getBlacklist(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function addToBlacklist(trackId: string) {
  const s = getBlacklist()
  s.add(trackId)
  localStorage.setItem(KEY, JSON.stringify([...s]))
}
