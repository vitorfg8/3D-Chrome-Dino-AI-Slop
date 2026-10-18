import './style.css'
import { Stage } from './render/Stage'
import { Game } from './game/Game'

const app = document.getElementById('app')
if (!app) throw new Error('Container #app ausente')

const stage = new Stage(app)
if (stage.ok) {
  const game = new Game(stage)
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
