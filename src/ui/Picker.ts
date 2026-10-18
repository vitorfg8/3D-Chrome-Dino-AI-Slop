import { SPECIES, type SpeciesId } from '../assets/species'
import { onLocale, speciesName, t } from '../i18n'

export class Picker {
  private readonly root: HTMLElement
  private selected: SpeciesId = 'trex'

  constructor(
    private readonly onPreview: (id: SpeciesId) => void,
    private readonly onConfirm: (id: SpeciesId) => void,
  ) {
    const root = document.createElement('div')
    root.id = 'picker'
    root.hidden = true
    const card = document.createElement('div')
    card.className = 'picker-card'
    const title = document.createElement('p')
    title.className = 'picker-title'
    title.dataset.i18n = 'pickTitle'
    const grid = document.createElement('div')
    grid.className = 'picker-grid'
    for (const species of SPECIES) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.species = species.id
      button.addEventListener('click', () => this.select(species.id))
      grid.append(button)
    }
    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.id = 'picker-confirm'
    confirm.addEventListener('click', () => this.onConfirm(this.selected))
    card.append(title, grid, confirm)
    root.append(card)
    document.body.append(root)
    this.root = root
    this.refresh()
    onLocale(() => this.refresh())
  }

  private refresh(): void {
    const title = this.root.querySelector('.picker-title')
    if (title) title.textContent = t('pickTitle')
    const confirm = this.root.querySelector('#picker-confirm')
    if (confirm) confirm.textContent = t('play')
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-species]')) {
      const id = button.dataset.species
      if (id) button.textContent = speciesName(id as SpeciesId)
    }
    this.mark()
  }

  open(id: SpeciesId = this.selected): void {
    this.selected = id
    this.mark()
    this.root.hidden = false
    document.body.classList.add('picking')
    this.onPreview(this.selected)
  }

  close(): void {
    this.root.hidden = true
    document.body.classList.remove('picking')
  }

  private select(id: SpeciesId): void {
    this.selected = id
    this.mark()
    this.onPreview(id)
  }

  private mark(): void {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-species]')) {
      button.classList.toggle('is-selected', button.dataset.species === this.selected)
    }
  }
}
