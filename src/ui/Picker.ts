import { SPECIES, type SpeciesId } from '../assets/species'

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
    title.textContent = 'ESCOLHA SEU DINOSSAURO'
    const grid = document.createElement('div')
    grid.className = 'picker-grid'
    for (const species of SPECIES) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.species = species.id
      button.textContent = species.label
      button.addEventListener('click', () => this.select(species.id))
      grid.append(button)
    }
    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.id = 'picker-confirm'
    confirm.textContent = 'JOGAR'
    confirm.addEventListener('click', () => this.onConfirm(this.selected))
    card.append(title, grid, confirm)
    root.append(card)
    document.body.append(root)
    this.root = root
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
