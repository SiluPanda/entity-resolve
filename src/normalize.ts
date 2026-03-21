const HONORIFICS = /\b(Dr|Mr|Mrs|Ms|Prof|Sir|Lady)\.\s*/gi
const SUFFIXES = /\b(Jr|Sr|II|III|Ltd|Inc|Corp|LLC)\.?\s*$/gi
const MULTI_SPACE = /\s+/g

export function normalizeName(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(HONORIFICS, '')
    .replace(SUFFIXES, '')
    .replace(MULTI_SPACE, ' ')
    .trim()
}
