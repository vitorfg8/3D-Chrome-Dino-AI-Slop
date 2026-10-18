import type { SpeciesId } from '../assets/species'
import { Dino } from '../entities/Dino'
import { Obstacles } from '../entities/Obstacles'
import { SpeciesDino } from '../entities/SpeciesDino'
import type { Stage } from '../render/Stage'
import { Hud, type HudMode } from '../ui/Hud'
import { Desert } from '../world/Desert'
import { CONFIG } from './config'
import { Spawner } from './Spawner'

type Mode = 'waiting' | 'running' | 'crashed'

type Runner = Dino | SpeciesDino

export class Game {
  private dino: Runner
  private readonly obstacles: Obstacles
  private readonly desert: Desert
  private readonly spawner = new Spawner()
  private readonly hud = new Hud()
  private readonly input = new Input()

  private mode: Mode = 'waiting'
  private species: SpeciesId = 'trex'
  private picking = false
  private speed = 0
  private distance = 0
  private score = 0
  private highScore = readBest()
  private night = 0
  private crashTimer = 0
  private milestone = 0
  private flashScore = false

  constructor(private readonly stage: Stage) {
    this.desert = new Desert(stage.scene)
    this.obstacles = new Obstacles(stage.scene)
    this.dino = new Dino(stage.scene)
    this.dino.reset()
  }

  update(dt: number): void {
    const input = this.input.consume()
    this.flashScore = false

    if (document.hidden) {
      this.stage.render(0)
      return
    }

    if (this.picking) {
      this.dino.update(dt, 'idle', false, false, 0)
    } else if (this.mode === 'waiting') {
      if (input.start) this.begin()
      else this.dino.update(dt, 'idle', false, false, 0)
    } else if (this.mode === 'crashed') {
      this.crashTimer += dt
      if (input.start && this.crashTimer >= CONFIG.crashLock) this.begin()
      else this.dino.update(dt, 'dead', false, false, 0)
    } else {
      this.speed = Math.min(CONFIG.maxSpeed, this.speed + CONFIG.acceleration * dt)
      this.distance += this.speed * dt
      this.score = Math.floor(this.distance * CONFIG.scoreScale)
      this.dino.update(dt, 'run', input.jump, input.duck, this.speed)
      this.obstacles.update(dt, this.speed)
      const order = this.spawner.pull(this.distance, this.speed, this.score, this.bodyGap())
      if (order) this.obstacles.spawn(order, CONFIG.spawnX)
      if (this.obstacles.hits(this.dino.hitboxes())) this.crash()
      const mark = Math.floor(this.score / CONFIG.blinkEvery)
      if (mark > this.milestone) {
        this.milestone = mark
        this.flashScore = true
      }
      if (this.dino.justLanded) this.desert.burst(CONFIG.dinoX, 0.55)
      if (this.dino.onGround) this.desert.puff(CONFIG.dinoX, this.dino.ducking ? this.speed * 0.25 : this.speed, dt)
    }

    const scroll = this.mode === 'running' && !this.picking ? this.speed : 0
    this.desert.update(dt, scroll)
    this.updateNight(dt)
    this.stage.setNight(this.night)
    this.desert.setNight(this.night)
    this.hud.render(this.mode satisfies HudMode, this.score, this.highScore, this.night > 0.45, this.flashScore)
    this.stage.render(dt)
  }

  preview(id: SpeciesId): void {
    this.picking = true
    this.use(id)
  }

  confirm(id: SpeciesId): void {
    this.picking = false
    this.use(id)
    this.mode = 'waiting'
    this.speed = 0
    this.night = 0
    this.obstacles.clear()
    this.dino.reset()
  }

  use(id: SpeciesId): void {
    this.species = id
    this.mount(id)
  }

  currentSpecies(): SpeciesId {
    return this.species
  }

  private mount(id: SpeciesId): void {
    this.dino.dispose()
    this.dino = id === 'trex' ? new Dino(this.stage.scene) : new SpeciesDino(this.stage.scene, id)
    this.dino.reset()
  }

  private bodyGap(): number {
    if (this.species !== 'apatosaurus' || !(this.dino instanceof SpeciesDino)) return 0
    return Math.max(0, this.dino.bodyLength - 4) * 0.55
  }

  private begin(): void {
    this.mode = 'running'
    this.speed = CONFIG.initialSpeed
    this.distance = 0
    this.score = 0
    this.milestone = 0
    this.crashTimer = 0
    this.night = 0
    this.spawner.reset()
    this.obstacles.clear()
    this.dino.reset()
  }

  private crash(): void {
    if (this.mode !== 'running') return
    this.mode = 'crashed'
    this.crashTimer = 0
    if (this.score > this.highScore) {
      this.highScore = this.score
      saveBest(this.highScore)
    }
    this.stage.kick()
    this.desert.burst(CONFIG.dinoX, 1)
    this.hud.hitFlash()
    this.dino.update(0, 'dead', false, false, 0)
  }

  private updateNight(dt: number): void {
    if (this.mode !== 'running') return
    const target = Math.floor(this.score / CONFIG.nightEvery) % 2 === 1 ? 1 : 0
    this.night += (target - this.night) * (1 - Math.exp(-dt * 0.35))
  }
}

class Input {
  private keyboardJump = false
  private pointerEdge = false
  private pointerUp = false
  private keyboardDuck = false
  private pointerDuck = false

  constructor() {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return
      if (isJump(event)) {
        event.preventDefault()
        this.keyboardJump = true
      }
      if (isDuck(event)) {
        event.preventDefault()
        this.keyboardDuck = true
      }
    })
    window.addEventListener('keyup', (event) => {
      if (isDuck(event)) this.keyboardDuck = false
    })
    window.addEventListener('pointerdown', (event) => {
      const target = event.target
      if (target instanceof Element && target.closest('#picker, #swap, #lang')) return
      this.pointerEdge = true
      this.pointerUp = event.clientY < window.innerHeight * 0.5
      if (!this.pointerUp) this.pointerDuck = true
    })
    window.addEventListener('pointerup', () => {
      this.pointerDuck = false
    })
    window.addEventListener('pointercancel', () => {
      this.pointerDuck = false
    })
    window.addEventListener('blur', () => {
      this.keyboardDuck = false
      this.pointerDuck = false
    })
    window.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false })
  }

  consume(): { start: boolean; jump: boolean; duck: boolean } {
    const start = this.keyboardJump || this.pointerEdge
    const jump = this.keyboardJump || (this.pointerEdge && this.pointerUp)
    const duck = this.keyboardDuck || this.pointerDuck
    this.keyboardJump = false
    this.pointerEdge = false
    return { start, jump, duck }
  }
}

function isJump(event: KeyboardEvent): boolean {
  return event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW'
}

function isDuck(event: KeyboardEvent): boolean {
  return event.code === 'ArrowDown' || event.code === 'KeyS'
}

function readBest(): number {
  try {
    const value = Number(localStorage.getItem(CONFIG.storageKey))
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  } catch {
    return 0
  }
}

function saveBest(score: number): void {
  try {
    localStorage.setItem(CONFIG.storageKey, String(score))
  } catch {
    // armazenamento privado pode recusar a escrita
  }
}
