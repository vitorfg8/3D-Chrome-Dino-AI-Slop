export const SPECIES = [
  { id: 'trex' },
  { id: 'velociraptor' },
  { id: 'triceratops' },
  { id: 'stegosaurus' },
  { id: 'parasaurolophus' },
  { id: 'apatosaurus' },
] as const

export type SpeciesId = (typeof SPECIES)[number]['id']

export const SPECIES_KEY = 'dino-2.5d-species'

export function isSpeciesId(value: string | null): value is SpeciesId {
  return SPECIES.some((species) => species.id === value)
}

export function readSpecies(): SpeciesId | null {
  try {
    const value = localStorage.getItem(SPECIES_KEY)
    return isSpeciesId(value) ? value : null
  } catch {
    return null
  }
}

export function saveSpecies(id: SpeciesId): void {
  try {
    localStorage.setItem(SPECIES_KEY, id)
  } catch {
    // armazenamento privado pode recusar a escrita
  }
}
