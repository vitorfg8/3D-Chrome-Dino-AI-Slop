import * as THREE from 'three'
import { CONFIG, overlap, type Aabb } from '../game/config'
import type { SpawnOrder } from '../game/Spawner'
export type ObstacleKind = 'cactus-small' | 'cactus-large' | 'ptero'

interface Item {
  kind: ObstacleKind
  group: THREE.Group
  plants: THREE.Object3D[]
  wingL: THREE.Object3D | null
  wingR: THREE.Object3D | null
  x: number
  baseY: number
  phase: number
}

export class Obstacles {
  private readonly pools: Record<ObstacleKind, Item[]> = {
    'cactus-small': [],
    'cactus-large': [],
    ptero: [],
  }
  private readonly live: Item[] = []

  constructor(
    private readonly scene: THREE.Scene,
    private readonly cactusSmall: THREE.Object3D,
    private readonly cactusLarge: THREE.Object3D,
    private readonly pterosaur: THREE.Object3D,
  ) {}

  spawn(order: SpawnOrder, x: number): void {
    const pool = this.pools[order.kind]
    const item = pool.pop() ?? this.create(order.kind)
    this.activate(item, order, x)
    this.live.push(item)
  }

  update(dt: number, speed: number): void {
    for (let i = this.live.length - 1; i >= 0; i -= 1) {
      const item = this.live[i]
      item.x -= speed * dt
      this.sync(item, dt, speed)
      if (item.x < CONFIG.despawnX) {
        item.group.visible = false
        this.pools[item.kind].push(item)
        this.live.splice(i, 1)
      }
    }
  }

  clear(): void {
    for (const item of this.live) {
      item.group.visible = false
      this.pools[item.kind].push(item)
    }
    this.live.length = 0
  }

  hits(boxes: Aabb[]): boolean {
    for (const item of this.live) {
      const obstacles = this.boxesFor(item)
      for (const box of boxes) {
        for (const obstacle of obstacles) {
          if (overlap(box, obstacle)) return true
        }
      }
    }
    return false
  }

  private create(kind: ObstacleKind): Item {
    const group = new THREE.Group()
    const plants: THREE.Object3D[] = []
    let wingL: THREE.Object3D | null = null
    let wingR: THREE.Object3D | null = null

    if (kind === 'ptero') {
      const built = this.pterosaur.clone(true)
      group.add(built)
      wingL = built.getObjectByName('wingL') ?? null
      wingR = built.getObjectByName('wingR') ?? null
    } else {
      const template = kind === 'cactus-small' ? this.cactusSmall : this.cactusLarge
      for (let i = 0; i < 3; i += 1) {
        const plant = template.clone(true)
        plant.visible = false
        group.add(plant)
        plants.push(plant)
      }
    }

    this.scene.add(group)
    return { kind, group, plants, wingL, wingR, x: 0, baseY: 0, phase: 0 }
  }

  private activate(item: Item, order: SpawnOrder, x: number): void {
    item.x = x
    item.phase = Math.random() * Math.PI * 2
    const scale = 0.94 + Math.random() * 0.12
    if (item.kind === 'ptero') {
      item.baseY = CONFIG.pteroY[order.lane]
      item.group.scale.setScalar(scale)
    } else {
      item.baseY = 0
      const spacing = item.kind === 'cactus-small' ? CONFIG.smallSpacing : CONFIG.largeSpacing
      const mid = (order.count - 1) / 2
      item.group.scale.set(scale, scale * (0.96 + Math.random() * 0.08), scale)
      item.plants.forEach((plant, index) => {
        plant.visible = index < order.count
        plant.position.x = (index - mid) * spacing
        plant.rotation.y = (Math.random() - 0.5) * 0.5
      })
    }
    item.group.visible = true
    this.sync(item, 0, 0)
  }

  private sync(item: Item, dt: number, speed: number): void {
    if (item.kind === 'ptero') {
      item.phase += dt * (6.4 + speed * 0.18)
      const flap = Math.sin(item.phase)
      if (item.wingL && item.wingR) {
        item.wingL.rotation.z = 0.2 + flap * 0.7
        item.wingR.rotation.z = -0.2 - flap * 0.7
      }
      item.group.position.set(item.x, item.baseY + Math.sin(item.phase * 0.5) * 0.06, 0)
      return
    }
    item.group.position.set(item.x, item.baseY, 0)
  }

  private boxesFor(item: Item): Aabb[] {
    const sx = item.group.scale.x
    const sy = item.group.scale.y
    if (item.kind === 'ptero') {
      const hitW = numberData(this.pterosaur.userData.hitW, 0.55)
      const hitH = numberData(this.pterosaur.userData.hitH, 0.32)
      return [
        {
          x: item.group.position.x,
          y: item.group.position.y,
          w: hitW * sx,
          h: hitH * sy,
        },
      ]
    }
    const height = (item.kind === 'cactus-large' ? CONFIG.largeHeight : CONFIG.smallHeight) * sy
    const width = (item.kind === 'cactus-large' ? 0.34 : 0.24) * sx
    const boxes: Aabb[] = []
    for (const plant of item.plants) {
      if (!plant.visible) continue
      boxes.push({
        x: item.group.position.x + plant.position.x * sx,
        y: height * 0.46,
        w: width,
        h: height * 0.92,
      })
    }
    return boxes
  }
}

function numberData(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
