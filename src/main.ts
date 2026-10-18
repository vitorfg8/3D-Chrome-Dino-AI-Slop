import './style.css'
import { readSpecies, saveSpecies } from './assets/species'
import { Game } from './game/Game'
import { Stage } from './render/Stage'
import { LangMenu } from './ui/LangMenu'
import { Picker } from './ui/Picker'

const app = document.getElementById('app')
if (!app) throw new Error('Container #app ausente')

const stage = new Stage(app)
if (stage.ok) {
  const game = new Game(stage)
  const saved = readSpecies()
  const picker = new Picker(
    (id) => game.preview(id),
    (id) => {
      saveSpecies(id)
      picker.close()
      game.confirm(id)
    },
  )
  new LangMenu()
  document.getElementById('swap')?.addEventListener('click', () => {
    picker.open(game.currentSpecies())
  })
  if (saved) game.use(saved)
  else picker.open()

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
