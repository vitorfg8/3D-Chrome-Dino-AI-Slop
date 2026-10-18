import * as THREE from 'three'
import { CONFIG, overlap, type Aabb } from '../game/config'
import type { SpawnOrder } from '../game/Spawner'
import { makeCactus } from './cactus'
import { makeEye } from './eyes'

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

const cactusMat = new THREE.MeshStandardMaterial({
  color: 0x2f7a3a,
  roughness: 0.78,
  metalness: 0.02,
})

const pteroBody = new THREE.MeshStandardMaterial({
  color: 0xa56b42,
  roughness: 0.62,
  metalness: 0.03,
})

const pteroWing = new THREE.MeshStandardMaterial({
  color: 0x6d4a34,
  roughness: 0.7,
  metalness: 0,
  side: THREE.DoubleSide,
})

const pteroBeak = new THREE.MeshStandardMaterial({
  color: 0xe7d3a4,
  roughness: 0.45,
  metalness: 0.04,
})

export class Obstacles {
  private readonly pools: Record<ObstacleKind, Item[]> = {
    'cactus-small': [],
    'cactus-large': [],
    ptero: [],
  }
  private readonly live: Item[] = []

  constructor(private readonly scene: THREE.Scene) {}

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
      const built = buildPtero()
      group.add(built.root)
      wingL = built.wingL
      wingR = built.wingR
    } else {
      const radius = kind === 'cactus-small' ? 0.12 : 0.18
      const height = kind === 'cactus-small' ? CONFIG.smallHeight : CONFIG.largeHeight
      for (let i = 0; i < 3; i += 1) {
        const plant = makeCactus(radius, height, cactusMat)
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
      return [
        {
          x: item.group.position.x + 0.04 * sx,
          y: item.group.position.y,
          w: 0.8 * sx,
          h: 0.34 * sy,
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

function buildPtero(): { root: THREE.Group; wingL: THREE.Group; wingR: THREE.Group } {
  const root = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.36, 4, 8), pteroBody)
  body.rotation.z = Math.PI / 2
  body.castShadow = true
  root.add(body)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), pteroBody)
  head.scale.set(1.15, 0.82, 0.9)
  head.position.set(-0.32, 0.05, 0)
  head.castShadow = true
  root.add(head)

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 6), pteroBeak)
  beak.rotation.z = Math.PI / 2
  beak.position.set(-0.52, 0.03, 0)
  beak.castShadow = true
  root.add(beak)

  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 5), pteroWing)
  crest.position.set(-0.22, 0.16, 0)
  crest.rotation.z = 2.4
  crest.castShadow = true
  root.add(crest)

  const pupil = new THREE.Vector3(0.018, 0, 0)
  const eyeL = makeEye(0.028, pupil)
  const eyeR = makeEye(0.028, pupil)
  eyeL.position.set(-0.36, 0.09, 0.055)
  eyeR.position.set(-0.36, 0.09, -0.055)
  root.add(eyeL, eyeR)

  const wingL = new THREE.Group()
  const wingR = new THREE.Group()
  wingL.position.set(-0.04, 0.08, 0.04)
  wingR.position.set(-0.04, 0.08, -0.04)
  const left = new THREE.Mesh(wingGeometry(), pteroWing)
  const right = new THREE.Mesh(wingGeometry(), pteroWing)
  left.castShadow = true
  right.castShadow = true
  wingL.add(left)
  wingR.add(right)
  root.add(wingL, wingR)

  return { root, wingL, wingR }
}

function wingGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(0.08, 0.42)
  shape.lineTo(0.46, 0.22)
  shape.lineTo(0.38, 0.02)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false })
  geo.translate(0, 0, -0.017)
  return geo
}
