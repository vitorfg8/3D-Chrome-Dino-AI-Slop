export const SPECIES = [
  { id: 'trex', label: 'Tiranossauro', file: 'trex.glb' },
  { id: 'velociraptor', label: 'Velociraptor', file: 'velociraptor.glb' },
  { id: 'triceratops', label: 'Tricerátopo', file: 'triceratops.glb' },
  { id: 'stegosaurus', label: 'Estegossauro', file: 'stegosaurus.glb' },
  { id: 'parasaurolophus', label: 'Parassaurolofo', file: 'parasaurolophus.glb' },
  { id: 'apatosaurus', label: 'Apatossauro', file: 'apatosaurus.glb' },
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
