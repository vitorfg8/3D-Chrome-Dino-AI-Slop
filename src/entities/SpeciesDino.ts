import * as THREE from 'three'
import type { SpeciesId } from '../assets/species'
import { CONFIG, type Aabb } from '../game/config'
import { makeEye } from './eyes'

type Kind = Exclude<SpeciesId, 'trex'>

interface Spec {
  hip: number
  thigh: number
  shin: number
  arm: number
  bodyLength: number
}

const SPECS: Record<Kind, Spec> = {
  velociraptor: { hip: 0.64, thigh: 0.34, shin: 0.3, arm: 0.16, bodyLength: 3.9 },
  triceratops: { hip: 0.62, thigh: 0.32, shin: 0.3, arm: 0.14, bodyLength: 4.1 },
  stegosaurus: { hip: 0.66, thigh: 0.36, shin: 0.3, arm: 0.14, bodyLength: 4.2 },
  parasaurolophus: { hip: 0.8, thigh: 0.42, shin: 0.38, arm: 0.16, bodyLength: 4 },
  apatosaurus: { hip: 0.92, thigh: 0.48, shin: 0.44, arm: 0.12, bodyLength: 6.2 },
}

interface Coat {
  skin: THREE.MeshStandardMaterial
  belly: THREE.MeshStandardMaterial
  dark: THREE.MeshStandardMaterial
  horn: THREE.MeshStandardMaterial
}

function coat(skin: number, belly: number, dark: number, horn: number): Coat {
  return {
    skin: new THREE.MeshStandardMaterial({ color: skin, roughness: 0.58, metalness: 0.02 }),
    belly: new THREE.MeshStandardMaterial({ color: belly, roughness: 0.66, metalness: 0 }),
    dark: new THREE.MeshStandardMaterial({ color: dark, roughness: 0.5, metalness: 0.02 }),
    horn: new THREE.MeshStandardMaterial({ color: horn, roughness: 0.42, metalness: 0.05 }),
  }
}

const COATS: Record<Kind, Coat> = {
  velociraptor: coat(0x8fb83a, 0xe4e6b4, 0x4d6b1e, 0xf2e6c4),
  triceratops: coat(0x8f5a34, 0xe6c4a0, 0x5c3820, 0xf3e6c8),
  stegosaurus: coat(0x2e7a58, 0xc5d6c4, 0x1c4e38, 0xe7dcc0),
  parasaurolophus: coat(0xb08a48, 0xf0d8b0, 0x6e5228, 0xf4e4c4),
  apatosaurus: coat(0x5a7568, 0xd4d2c0, 0x3a4e44, 0xe8e2cc),
}

export class SpeciesDino {
  readonly root = new THREE.Group()
  readonly bodyLength: number
  y = 0
  vy = 0
  onGround = true
  ducking = false
  justLanded = false

  private readonly spec: Spec
  private readonly coat: Coat
  private readonly body = new THREE.Group()
  private readonly torso = new THREE.Group()
  private readonly thighL: THREE.Group
  private readonly thighR: THREE.Group
  private readonly shinL: THREE.Group
  private readonly shinR: THREE.Group
  private readonly footL = new THREE.Group()
  private readonly footR = new THREE.Group()
  private readonly tail1 = new THREE.Group()
  private readonly tail2 = new THREE.Group()
  private readonly tail3 = new THREE.Group()
  private readonly armL: THREE.Group
  private readonly armR: THREE.Group
  private readonly jaw = new THREE.Group()
  private readonly eyes = new THREE.Group()
  private readonly blob: THREE.Mesh
  private readonly blobMat: THREE.MeshBasicMaterial

  private pose: 'idle' | 'run' | 'jump' | 'duck' | 'crash' = 'idle'
  private phase = 0
  private blink = 0
  private blinkTimer = 1.4
  private snap = true
  private duckWas = false
  private dropping = false

  constructor(
    scene: THREE.Scene,
    private readonly kind: Kind,
  ) {
    this.spec = SPECS[kind]
    this.coat = COATS[kind]
    this.bodyLength = this.spec.bodyLength
    this.thighL = limb(this.spec.thigh, 0.07, this.coat.skin)
    this.thighR = limb(this.spec.thigh, 0.07, this.coat.skin)
    this.shinL = limb(this.spec.shin, 0.05, this.coat.skin)
    this.shinR = limb(this.spec.shin, 0.05, this.coat.skin)
    this.armL = limb(this.spec.arm, 0.03, this.coat.skin)
    this.armR = limb(this.spec.arm, 0.03, this.coat.skin)
    this.build()
    scene.add(this.root)

    this.blobMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    })
    const shadow = kind === 'apatosaurus' ? 0.72 : 0.42
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(shadow, 24), this.blobMat)
    this.blob.rotation.x = -Math.PI / 2
    this.blob.position.y = 0.03
    scene.add(this.blob)
  }

  dispose(): void {
    this.root.removeFromParent()
    this.blob.removeFromParent()
  }

  reset(): void {
    this.y = 0
    this.vy = 0
    this.onGround = true
    this.ducking = false
    this.justLanded = false
    this.pose = 'idle'
    this.phase = 0
    this.snap = true
    this.duckWas = false
    this.dropping = false
    this.root.position.set(CONFIG.dinoX, 0, 0)
  }

  update(dt: number, mode: 'idle' | 'run' | 'dead', jump: boolean, duck: boolean, speed: number): void {
    this.justLanded = false
    if (mode === 'dead') {
      this.pose = 'crash'
      this.ducking = false
      this.animate(dt, 0, mode)
      this.syncShadow()
      return
    }
    if (mode === 'idle') {
      this.y = 0
      this.vy = 0
      this.onGround = true
      this.ducking = false
      this.pose = 'idle'
      this.animate(dt, 0, mode)
      this.root.position.set(CONFIG.dinoX, 0, 0)
      this.syncShadow()
      return
    }

    const duckPressed = duck && !this.duckWas
    this.duckWas = duck
    if (jump && this.onGround) {
      this.vy = CONFIG.jumpVelocity
      this.onGround = false
      this.ducking = false
      this.dropping = false
    } else if (!this.onGround && (this.dropping || duckPressed)) {
      this.dropping = true
      if (this.vy > 0) this.vy = 0
    }
    if (!duck) this.dropping = false
    const grav = CONFIG.gravity * (this.dropping ? CONFIG.fastFall : 1)
    const wasAir = !this.onGround
    this.vy -= grav * dt
    this.y += this.vy * dt
    if (this.y <= 0) {
      this.y = 0
      this.vy = 0
      this.onGround = true
      this.justLanded = wasAir
      this.dropping = false
    }
    this.ducking = duck && this.onGround
    this.pose = !this.onGround ? 'jump' : this.ducking ? 'duck' : 'run'
    this.animate(dt, speed, mode)
    this.root.position.set(CONFIG.dinoX, this.y, 0)
    this.syncShadow()
  }

  hitboxes(): Aabb[] {
    if (this.ducking) {
      const wide = this.kind === 'apatosaurus' ? 1.7 : 1.2
      return [{ x: CONFIG.dinoX + 0.12, y: this.y + 0.3, w: wide, h: 0.46 }]
    }
    if (this.kind === 'apatosaurus') {
      return [
        { x: CONFIG.dinoX - 0.35, y: this.y + 0.55, w: 1.35, h: 0.95 },
        { x: CONFIG.dinoX + 0.85, y: this.y + 0.95, w: 1.35, h: 0.55 },
      ]
    }
    return [
      { x: CONFIG.dinoX - 0.02, y: this.y + 0.7, w: 0.78, h: 0.78 },
      { x: CONFIG.dinoX + 0.48, y: this.y + 1.28, w: 0.46, h: 0.38 },
    ]
  }

  private syncShadow(): void {
    const lift = Math.min(1, this.y / 1.7)
    this.blob.position.x = CONFIG.dinoX + (this.kind === 'apatosaurus' ? 0.35 : 0.05)
    this.blob.position.z = 0.02
    this.blob.scale.setScalar(1 - lift * 0.5)
    this.blobMat.opacity = 0.34 * (1 - lift * 0.75)
  }

  private animate(dt: number, speed: number, mode: 'idle' | 'run' | 'dead'): void {
    const hip = this.spec.hip
    if (this.pose === 'run') this.phase += dt * (10 + speed * 0.85)
    else if (mode === 'idle') this.phase += dt * 1.5

    const s = Math.sin(this.phase)
    let thighL = 0.42
    let thighR = 0.42
    let shinL = -0.95
    let shinR = -0.95
    let torsoZ = 0.04
    let hipY = hip
    let tailZ = s * 0.06
    let bodyY = Math.sin(this.phase) * 0.012
    let armL = 0.55
    let armR = 0.55
    let jawZ = 0.04

    if (this.pose === 'crash') {
      torsoZ = -1.02
      hipY = hip - 0.02
      thighL = 0.55
      thighR = -0.15
      shinL = -0.35
      shinR = -1.15
      tailZ = 0.45
      bodyY = 0.02
      armL = 1.15
      armR = 1.25
      jawZ = 0.42
    } else if (this.pose === 'jump') {
      thighL = 1.05
      thighR = 1.05
      shinL = -1.55
      shinR = -1.55
      torsoZ = -0.28
      tailZ = 0.32
      bodyY = 0
      armL = -0.35
      armR = -0.35
      jawZ = 0.12
    } else if (this.pose === 'duck') {
      thighL = 1.2
      thighR = 1.2
      shinL = -2.15
      shinR = -2.15
      torsoZ = -0.9
      hipY = hip - 0.24
      tailZ = 0.5
      bodyY = 0
      armL = 0.9
      armR = 0.9
      jawZ = 0.02
    } else if (this.pose === 'run') {
      thighL = 0.38 + s * 0.62
      thighR = 0.38 - s * 0.62
      shinL = -0.75 - Math.max(0, -s) * 0.85
      shinR = -0.75 - Math.max(0, s) * 0.85
      torsoZ = 0.02 + Math.sin(this.phase * 2) * 0.025
      tailZ = -s * 0.2
      bodyY = Math.abs(Math.sin(this.phase * 2)) * 0.045
      armL = 0.35 - s * 0.3
      armR = 0.35 + s * 0.3
      jawZ = 0.06
    }

    const k = this.snap ? 1 : 1 - Math.exp(-14 * dt)
    this.snap = false
    const mix = (current: number, target: number) => current + (target - current) * k

    this.thighL.rotation.z = mix(this.thighL.rotation.z, thighL)
    this.thighR.rotation.z = mix(this.thighR.rotation.z, thighR)
    this.shinL.rotation.z = mix(this.shinL.rotation.z, shinL)
    this.shinR.rotation.z = mix(this.shinR.rotation.z, shinR)
    this.footL.rotation.z = -this.thighL.rotation.z - this.shinL.rotation.z + 0.08
    this.footR.rotation.z = -this.thighR.rotation.z - this.shinR.rotation.z + 0.08
    this.torso.rotation.z = mix(this.torso.rotation.z, torsoZ)
    this.torso.position.y = mix(this.torso.position.y, hipY)
    this.thighL.position.y = this.torso.position.y
    this.thighR.position.y = this.torso.position.y
    this.body.position.y = mix(this.body.position.y, bodyY)
    this.tail1.rotation.z = mix(this.tail1.rotation.z, tailZ)
    this.tail2.rotation.z = mix(this.tail2.rotation.z, tailZ * 0.7)
    this.tail3.rotation.z = mix(this.tail3.rotation.z, tailZ * 0.45)
    this.armL.rotation.z = mix(this.armL.rotation.z, armL)
    this.armR.rotation.z = mix(this.armR.rotation.z, armR)
    this.jaw.rotation.z = mix(this.jaw.rotation.z, jawZ)

    this.blinkTimer -= dt
    if (this.blinkTimer <= 0 && mode !== 'dead') {
      this.blink = 0.09
      this.blinkTimer = 2.1 + Math.random() * 2.8
    }
    if (this.blink > 0) {
      this.blink -= dt
      this.eyes.scale.y = 0.12
    } else {
      this.eyes.scale.y = 1
    }
  }

  private build(): void {
    this.root.add(this.body)
    this.body.add(this.torso)
    if (this.kind === 'velociraptor') this.buildRaptor()
    else if (this.kind === 'triceratops') this.buildTrike()
    else if (this.kind === 'stegosaurus') this.buildStego()
    else if (this.kind === 'parasaurolophus') this.buildPara()
    else this.buildApato()
    this.attachLegs()
  }

  private attachLegs(): void {
    this.shinL.position.y = -this.spec.thigh
    this.shinR.position.y = -this.spec.thigh
    this.thighL.add(this.shinL)
    this.thighR.add(this.shinR)
    this.footL.position.y = -this.spec.shin
    this.footR.position.y = -this.spec.shin
    this.shinL.add(this.footL)
    this.shinR.add(this.footR)
    this.footL.add(footMesh(this.kind === 'velociraptor', this.coat))
    this.footR.add(footMesh(this.kind === 'velociraptor', this.coat))
    this.thighL.position.set(0.04, this.spec.hip, 0.11)
    this.thighR.position.set(0.04, this.spec.hip, -0.11)
    this.body.add(this.thighL, this.thighR)
    this.torso.position.y = this.spec.hip
  }

  private buildRaptor(): void {
    const torsoMesh = shaded(new THREE.CapsuleGeometry(0.16, 0.48, 4, 10), this.coat.skin)
    torsoMesh.rotation.z = -0.95
    torsoMesh.position.set(0.02, 0.22, 0)
    this.torso.add(torsoMesh)
    const hip = shaded(new THREE.SphereGeometry(0.18, 12, 10), this.coat.skin)
    hip.position.set(-0.08, 0.04, 0)
    this.torso.add(hip)
    const belly = shaded(new THREE.SphereGeometry(0.1, 10, 8), this.coat.belly)
    belly.scale.set(1.4, 0.55, 0.6)
    belly.position.set(0.08, 0.02, 0)
    this.torso.add(belly)

    const neck = shaded(new THREE.CapsuleGeometry(0.07, 0.2, 3, 8), this.coat.skin)
    neck.position.set(0.22, 0.34, 0)
    neck.rotation.z = -0.7
    this.torso.add(neck)

    const head = new THREE.Group()
    head.position.set(0.34, 0.5, 0)
    this.torso.add(head)
    const skull = shaded(new THREE.SphereGeometry(0.12, 12, 10), this.coat.skin)
    skull.scale.set(1.35, 0.72, 0.78)
    head.add(skull)
    const snout = shaded(new THREE.CapsuleGeometry(0.045, 0.16, 3, 6), this.coat.skin)
    snout.rotation.z = Math.PI / 2
    snout.position.set(0.18, -0.02, 0)
    head.add(snout)
    this.placeFace(head, 0.08, 0.02, 0.05)
    this.chainTail(0.12, 0.34, 0.09, 0.28, 0.05, 0.24)
    this.armL.position.set(0.2, 0.16, 0.1)
    this.armR.position.set(0.2, 0.16, -0.1)
    this.torso.add(this.armL, this.armR)
  }

  private buildTrike(): void {
    const torsoMesh = shaded(new THREE.CapsuleGeometry(0.28, 0.62, 4, 10), this.coat.skin)
    torsoMesh.rotation.z = -0.35
    torsoMesh.position.set(0.08, 0.18, 0)
    this.torso.add(torsoMesh)
    const belly = shaded(new THREE.SphereGeometry(0.2, 12, 10), this.coat.belly)
    belly.scale.set(1.2, 0.55, 0.85)
    belly.position.set(0.1, 0.02, 0)
    this.torso.add(belly)

    const head = new THREE.Group()
    head.position.set(0.48, 0.32, 0)
    this.torso.add(head)
    const skull = shaded(new THREE.SphereGeometry(0.16, 12, 10), this.coat.skin)
    skull.scale.set(1.1, 0.85, 1.05)
    head.add(skull)
    const beak = shaded(new THREE.ConeGeometry(0.07, 0.18, 5), this.coat.horn)
    beak.rotation.z = -Math.PI / 2
    beak.position.set(0.18, -0.02, 0)
    head.add(beak)
    const nose = shaded(new THREE.ConeGeometry(0.035, 0.14, 5), this.coat.horn)
    nose.rotation.z = -0.4
    nose.position.set(0.1, 0.08, 0)
    head.add(nose)
    const browL = shaded(new THREE.ConeGeometry(0.04, 0.22, 5), this.coat.horn)
    const browR = browL.clone()
    browL.position.set(0.04, 0.12, 0.08)
    browR.position.set(0.04, 0.12, -0.08)
    browL.rotation.z = -0.5
    browR.rotation.z = -0.5
    head.add(browL, browR)
    const frill = shaded(new THREE.SphereGeometry(0.22, 14, 10), this.coat.skin)
    frill.scale.set(0.35, 1.15, 1.35)
    frill.position.set(-0.12, 0.08, 0)
    head.add(frill)
    for (let i = 0; i < 5; i += 1) {
      const stud = shaded(new THREE.ConeGeometry(0.025, 0.06, 4), this.coat.horn)
      const a = (i - 2) * 0.35
      stud.position.set(-0.16, 0.08 + Math.cos(a) * 0.16, Math.sin(a) * 0.2)
      head.add(stud)
    }
    this.placeFace(head, 0.06, 0.04, 0.09)
    this.chainTail(0.1, 0.16, 0.07, 0.12, 0.045, 0.1)
    this.armL.position.set(0.28, 0.08, 0.16)
    this.armR.position.set(0.28, 0.08, -0.16)
    this.torso.add(this.armL, this.armR)
  }

  private buildStego(): void {
    const torsoMesh = shaded(new THREE.CapsuleGeometry(0.22, 0.7, 4, 10), this.coat.skin)
    torsoMesh.rotation.z = -0.25
    torsoMesh.position.set(0.02, 0.16, 0)
    this.torso.add(torsoMesh)
    const belly = shaded(new THREE.SphereGeometry(0.16, 12, 10), this.coat.belly)
    belly.scale.set(1.5, 0.5, 0.8)
    belly.position.set(0.04, -0.02, 0)
    this.torso.add(belly)

    const heights = [0.16, 0.28, 0.38, 0.32, 0.22, 0.14]
    for (let i = 0; i < heights.length; i += 1) {
      const plate = shaded(new THREE.ConeGeometry(0.07, heights[i], 4), this.coat.dark)
      plate.position.set(0.28 - i * 0.12, 0.28 + heights[i] * 0.35, 0)
      this.torso.add(plate)
    }

    const head = new THREE.Group()
    head.position.set(0.46, 0.28, 0)
    this.torso.add(head)
    const skull = shaded(new THREE.SphereGeometry(0.11, 12, 10), this.coat.skin)
    skull.scale.set(1.3, 0.75, 0.8)
    head.add(skull)
    const snout = shaded(new THREE.SphereGeometry(0.07, 10, 8), this.coat.skin)
    snout.scale.set(1.4, 0.6, 0.7)
    snout.position.set(0.12, -0.02, 0)
    head.add(snout)
    this.placeFace(head, 0.05, 0.02, 0.055)
    this.chainTail(0.11, 0.22, 0.08, 0.2, 0.05, 0.18)
    for (const z of [-0.05, 0.05]) {
      for (const x of [-0.02, 0.06]) {
        const spike = shaded(new THREE.ConeGeometry(0.025, 0.12, 4), this.coat.horn)
        spike.rotation.z = Math.PI / 2
        spike.position.set(x, 0, z)
        this.tail3.add(spike)
      }
    }
    this.armL.position.set(0.22, 0.08, 0.14)
    this.armR.position.set(0.22, 0.08, -0.14)
    this.torso.add(this.armL, this.armR)
  }

  private buildPara(): void {
    const torsoMesh = shaded(new THREE.CapsuleGeometry(0.2, 0.5, 4, 10), this.coat.skin)
    torsoMesh.rotation.z = -0.7
    torsoMesh.position.set(0.04, 0.24, 0)
    this.torso.add(torsoMesh)
    const belly = shaded(new THREE.SphereGeometry(0.13, 12, 10), this.coat.belly)
    belly.scale.set(1.3, 0.55, 0.7)
    belly.position.set(0.08, 0.04, 0)
    this.torso.add(belly)
    const neck = shaded(new THREE.CapsuleGeometry(0.08, 0.18, 3, 8), this.coat.skin)
    neck.position.set(0.26, 0.4, 0)
    neck.rotation.z = -0.55
    this.torso.add(neck)

    const head = new THREE.Group()
    head.position.set(0.4, 0.56, 0)
    this.torso.add(head)
    const skull = shaded(new THREE.SphereGeometry(0.13, 12, 10), this.coat.skin)
    skull.scale.set(1.15, 0.8, 0.85)
    head.add(skull)
    const bill = shaded(new THREE.SphereGeometry(0.09, 10, 8), this.coat.belly)
    bill.scale.set(1.7, 0.38, 0.7)
    bill.position.set(0.16, -0.02, 0)
    head.add(bill)
    const crest = shaded(new THREE.CapsuleGeometry(0.045, 0.42, 4, 8), this.coat.dark)
    crest.position.set(-0.16, 0.22, 0)
    crest.rotation.z = 0.9
    head.add(crest)
    this.placeFace(head, 0.08, 0.03, 0.06)
    this.chainTail(0.1, 0.2, 0.07, 0.16, 0.045, 0.14)
    this.armL.position.set(0.24, 0.14, 0.12)
    this.armR.position.set(0.24, 0.14, -0.12)
    this.torso.add(this.armL, this.armR)
  }

  private buildApato(): void {
    const torsoMesh = shaded(new THREE.CapsuleGeometry(0.32, 0.7, 4, 10), this.coat.skin)
    torsoMesh.rotation.z = -0.15
    torsoMesh.position.set(0.05, 0.16, 0)
    this.torso.add(torsoMesh)
    const belly = shaded(new THREE.SphereGeometry(0.22, 12, 10), this.coat.belly)
    belly.scale.set(1.35, 0.6, 0.85)
    belly.position.set(0.08, -0.02, 0)
    this.torso.add(belly)

    const neck = new THREE.Group()
    neck.position.set(0.48, 0.22, 0)
    neck.rotation.z = -1.2
    const n1 = shaded(new THREE.CapsuleGeometry(0.1, 0.5, 3, 8), this.coat.skin)
    n1.position.y = 0.32
    neck.add(n1)
    const n2 = shaded(new THREE.CapsuleGeometry(0.075, 0.46, 3, 8), this.coat.skin)
    n2.position.set(0.05, 0.78, 0)
    n2.rotation.z = -0.2
    neck.add(n2)
    this.torso.add(neck)

    const head = new THREE.Group()
    head.position.set(0.16, 1.12, 0)
    neck.add(head)
    const skull = shaded(new THREE.SphereGeometry(0.1, 12, 10), this.coat.skin)
    skull.scale.set(1.25, 0.75, 0.8)
    head.add(skull)
    const snout = shaded(new THREE.SphereGeometry(0.06, 10, 8), this.coat.skin)
    snout.scale.set(1.5, 0.55, 0.7)
    snout.position.set(0.1, -0.01, 0)
    head.add(snout)
    this.placeFace(head, 0.04, 0.02, 0.05)
    this.chainTail(0.14, 0.55, 0.1, 0.5, 0.06, 0.42)
    this.armL.position.set(0.3, 0.1, 0.18)
    this.armR.position.set(0.3, 0.1, -0.18)
    this.torso.add(this.armL, this.armR)
  }

  private placeFace(head: THREE.Group, eyeX: number, eyeY: number, eyeZ: number): void {
    this.jaw.position.set(eyeX + 0.04, eyeY - 0.08, 0)
    const jawMesh = shaded(new THREE.SphereGeometry(0.05, 8, 6), this.coat.belly)
    jawMesh.scale.set(1.4, 0.4, 0.7)
    jawMesh.position.x = 0.04
    this.jaw.add(jawMesh)
    head.add(this.jaw)
    this.eyes.position.set(eyeX, eyeY, 0)
    const pupil = new THREE.Vector3(0.025, 0, 0)
    const eyeL = makeEye(0.04, pupil)
    const eyeR = makeEye(0.04, pupil)
    eyeL.position.z = eyeZ
    eyeR.position.z = -eyeZ
    this.eyes.add(eyeL, eyeR)
    head.add(this.eyes)
  }

  private chainTail(r1: number, l1: number, r2: number, l2: number, r3: number, l3: number): void {
    this.tail1.position.set(-0.28, 0.08, 0)
    const t1 = shaded(new THREE.CapsuleGeometry(r1, l1, 3, 8), this.coat.skin)
    t1.rotation.z = Math.PI / 2
    t1.position.x = -l1 * 0.55
    this.tail1.add(t1)
    this.tail2.position.set(-l1 * 0.9, -0.02, 0)
    const t2 = shaded(new THREE.CapsuleGeometry(r2, l2, 3, 8), this.coat.skin)
    t2.rotation.z = Math.PI / 2
    t2.position.x = -l2 * 0.5
    this.tail2.add(t2)
    this.tail3.position.set(-l2 * 0.85, -0.02, 0)
    const t3 = shaded(new THREE.CapsuleGeometry(r3, l3, 2, 6), this.coat.skin)
    t3.rotation.z = Math.PI / 2
    t3.position.x = -l3 * 0.45
    this.tail3.add(t3)
    this.tail2.add(this.tail3)
    this.tail1.add(this.tail2)
    this.torso.add(this.tail1)
  }
}

function shaded(geo: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function limb(length: number, radius: number, material: THREE.Material): THREE.Group {
  const pivot = new THREE.Group()
  const mesh = shaded(
    new THREE.CapsuleGeometry(radius, Math.max(0.02, length - radius * 2), 3, 8),
    material,
  )
  mesh.position.y = -length / 2
  pivot.add(mesh)
  return pivot
}

function footMesh(sickle: boolean, colors: Coat): THREE.Group {
  const group = new THREE.Group()
  const sole = shaded(new THREE.CapsuleGeometry(0.04, 0.12, 2, 6), colors.skin)
  sole.rotation.z = Math.PI / 2
  sole.position.x = 0.07
  group.add(sole)
  if (sickle) {
    const claw = shaded(new THREE.ConeGeometry(0.032, 0.2, 5), colors.horn)
    claw.rotation.z = -2.2
    claw.position.set(0.04, 0.04, 0.07)
    group.add(claw)
  }
  for (let i = 0; i < 3; i += 1) {
    const claw = shaded(new THREE.ConeGeometry(0.016, 0.06, 4), colors.horn)
    claw.rotation.z = -Math.PI / 2
    claw.position.set(0.16, -0.01, (i - 1) * 0.03)
    group.add(claw)
  }
  return group
}
