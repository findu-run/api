export function capitalizeName(name: string): string {
  if (!name || typeof name !== 'string') return ''
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
    .trim()
}