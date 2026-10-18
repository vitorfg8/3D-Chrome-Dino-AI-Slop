import './style.css'
import { Stage } from './render/Stage'
import { Game } from './game/Game'
import { loadModels } from './assets/loadModels'
import { readSpecies, saveSpecies } from './assets/species'
import { Picker } from './ui/Picker'

const app = document.getElementById('app')
if (!app) throw new Error('Container #app ausente')

const stage = new Stage(app)
if (stage.ok) {
  const models = await loadModels()
  const saved = readSpecies()
  const game = new Game(stage, models, saved)
  const picker = new Picker(
    (id) => game.preview(id),
    (id) => {
      saveSpecies(id)
      game.confirm()
      picker.close()
    },
  )
  document.getElementById('swap')?.addEventListener('click', () => {
    picker.open(game.currentSpecies())
  })
  if (!saved) picker.open()
  game.update(1 / 60)
  let last = performance.now()
  const loop = (now: number) => {
    const dt = Math.min(0.033, (now - last) / 1000)
    last = now
    game.update(dt)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}
