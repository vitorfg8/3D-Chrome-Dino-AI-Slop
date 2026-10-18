import type { SpeciesId } from './assets/species'

export const LOCALES = ['pt-BR', 'es', 'en'] as const
export type Locale = (typeof LOCALES)[number]

const STORAGE_KEY = 'dino-2.5d-lang'

const TEXT = {
  'pt-BR': {
    startTitle: 'ESPAÇO PARA COMEÇAR',
    startHint: 'seta para cima pula · seta para baixo agacha',
    gameOver: 'GAME OVER',
    restartHint: 'espaço para reiniciar',
    swap: 'TROCAR DINOSSAURO',
    pickTitle: 'ESCOLHA SEU DINOSSAURO',
    play: 'JOGAR',
    language: 'Português',
    'species.trex': 'Tiranossauro',
    'species.velociraptor': 'Velociraptor',
    'species.triceratops': 'Tricerátopo',
    'species.stegosaurus': 'Estegossauro',
    'species.parasaurolophus': 'Parassaurolofo',
    'species.apatosaurus': 'Apatossauro',
  },
  es: {
    startTitle: 'ESPACIO PARA EMPEZAR',
    startHint: 'flecha arriba salta · flecha abajo se agacha',
    gameOver: 'GAME OVER',
    restartHint: 'espacio para reiniciar',
    swap: 'CAMBIAR DINOSAURIO',
    pickTitle: 'ELIGE TU DINOSAURIO',
    play: 'JUGAR',
    language: 'Español',
    'species.trex': 'Tiranosaurio',
    'species.velociraptor': 'Velociraptor',
    'species.triceratops': 'Tricerátopo',
    'species.stegosaurus': 'Estegosaurio',
    'species.parasaurolophus': 'Parasaurolofo',
    'species.apatosaurus': 'Apatosaurio',
  },
  en: {
    startTitle: 'SPACE TO START',
    startHint: 'up arrow jumps · down arrow ducks',
    gameOver: 'GAME OVER',
    restartHint: 'space to restart',
    swap: 'CHANGE DINOSAUR',
    pickTitle: 'CHOOSE YOUR DINOSAUR',
    play: 'PLAY',
    language: 'English',
    'species.trex': 'T-Rex',
    'species.velociraptor': 'Velociraptor',
    'species.triceratops': 'Triceratops',
    'species.stegosaurus': 'Stegosaurus',
    'species.parasaurolophus': 'Parasaurolophus',
    'species.apatosaurus': 'Apatosaurus',
  },
} as const

export type TextKey = keyof (typeof TEXT)['pt-BR']

const listeners = new Set<() => void>()
let locale = readLocale()

applyDocumentLang()

export function t(key: TextKey): string {
  return TEXT[locale][key]
}

export function speciesName(id: SpeciesId): string {
  return t(`species.${id}`)
}

export function getLocale(): Locale {
  return locale
}

export function setLocale(next: Locale): void {
  locale = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // armazenamento privado pode recusar a escrita
  }
  applyDocumentLang()
  for (const listener of listeners) listener()
}

export function onLocale(listener: () => void): void {
  listeners.add(listener)
}

function applyDocumentLang(): void {
  document.documentElement.lang = locale
}

function readLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLocale(saved)) return saved
  } catch {
    // segue para o idioma do navegador
  }
  const language = navigator.language.toLowerCase()
  if (language.startsWith('pt')) return 'pt-BR'
  if (language.startsWith('es')) return 'es'
  if (language.startsWith('en')) return 'en'
  return 'pt-BR'
}

function isLocale(value: string | null): value is Locale {
  return LOCALES.some((item) => item === value)
}
