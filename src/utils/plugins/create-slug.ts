export function createSlug(text: string): string {
  return text
    .normalize('NFD') // Normaliza os caracteres com acentos
    .replace(/\p{Diacritic}/gu, '') // Remove diacríticos usando propriedade Unicode
    .replace(/[^\w\s-]/g, '') // Remove caracteres não alfanuméricos, exceto espaços e hifens
    .trim() // Remove espaços em branco no início e no fim
    .replace(/\s+/g, '-') // Substitui espaços por hifens
    .toLowerCase() // Converte para minúsculas
}