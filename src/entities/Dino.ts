import * as THREE from 'three'
import { CONFIG, type Aabb } from '../game/config'

const HIP = 0.76
const THIGH = 0.4
const SHIN = 0.36

const skin = new THREE.MeshStandardMaterial({ color: 0x7c8b52, roughness: 0.58, metalness: 0.02 })
const bellyMat = new THREE.MeshStandardMaterial({ color: 0xe4d2ae, roughness: 0.66, metalness: 0 })
const dark = new THREE.MeshStandardMaterial({ color: 0x45502f, roughness: 0.5, metalness: 0.02 })
const horn = new THREE.MeshStandardMaterial({ color: 0xefe4cc, roughness: 0.42, metalness: 0.05 })
const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.25 })
const pupilMat = new THREE.MeshStandardMaterial({ color: 0x140e0a, roughness: 0.3 })

export class Dino {
  readonly root = new THREE.Group()
  y = 0
  vy = 0
  onGround = true
  ducking = false
  justLanded = false

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

  constructor(scene: THREE.Scene) {
    this.thighL = limb(THIGH, 0.078, skin)
    this.thighR = limb(THIGH, 0.078, skin)
    this.shinL = limb(SHIN, 0.055, skin)
    this.shinR = limb(SHIN, 0.055, skin)
    this.armL = limb(0.18, 0.035, skin)
    this.armR = limb(0.18, 0.035, skin)
    this.build()
    scene.add(this.root)

    this.blobMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    })
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), this.blobMat)
    this.blob.rotation.x = -Math.PI / 2
    this.blob.position.y = 0.03
    scene.add(this.blob)
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
      return [{ x: CONFIG.dinoX + 0.12, y: this.y + 0.3, w: 1.2, h: 0.46 }]
    }
    return [
      { x: CONFIG.dinoX - 0.02, y: this.y + 0.74, w: 0.78, h: 0.82 },
      { x: CONFIG.dinoX + 0.55, y: this.y + 1.42, w: 0.5, h: 0.4 },
    ]
  }

  private syncShadow(): void {
    const lift = Math.min(1, this.y / 1.7)
    this.blob.position.x = CONFIG.dinoX + 0.05
    this.blob.position.z = 0.02
    this.blob.scale.setScalar(1 - lift * 0.5)
    this.blobMat.opacity = 0.34 * (1 - lift * 0.75)
  }

  private animate(dt: number, speed: number, mode: 'idle' | 'run' | 'dead'): void {
    if (this.pose === 'run') this.phase += dt * (10 + speed * 0.85)
    else if (mode === 'idle') this.phase += dt * 1.5

    const s = Math.sin(this.phase)
    let thighL = 0.42
    let thighR = 0.42
    let shinL = -0.95
    let shinR = -0.95
    let torsoZ = 0.04
    let hipY = HIP
    let tailZ = s * 0.06
    let bodyY = Math.sin(this.phase) * 0.012
    let armL = 0.55
    let armR = 0.55
    let jawZ = 0.04

    if (this.pose === 'crash') {
      torsoZ = -1.02
      hipY = HIP - 0.02
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
      hipY = HIP - 0.24
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

    const torsoMesh = shaded(new THREE.CapsuleGeometry(0.24, 0.58, 4, 10), skin)
    torsoMesh.rotation.z = -0.72
    torsoMesh.position.set(0.06, 0.28, 0)
    this.torso.add(torsoMesh)

    const hip = shaded(new THREE.SphereGeometry(0.26, 14, 12), skin)
    hip.scale.set(1.05, 0.9, 0.95)
    hip.position.set(-0.02, 0.08, 0)
    this.torso.add(hip)

    const belly = shaded(new THREE.SphereGeometry(0.16, 12, 10), bellyMat)
    belly.scale.set(1.35, 0.62, 0.72)
    belly.position.set(0.12, 0.06, 0)
    this.torso.add(belly)

    const neck = shaded(new THREE.CapsuleGeometry(0.13, 0.22, 3, 8), skin)
    neck.position.set(0.32, 0.42, 0)
    neck.rotation.z = -0.42
    this.torso.add(neck)

    const head = new THREE.Group()
    head.position.set(0.46, 0.62, 0)
    this.torso.add(head)

    const skull = shaded(new THREE.SphereGeometry(0.2, 14, 12), skin)
    skull.scale.set(1.2, 0.86, 0.92)
    head.add(skull)

    const snout = shaded(new THREE.SphereGeometry(0.13, 12, 10), skin)
    snout.scale.set(1.45, 0.62, 0.78)
    snout.position.set(0.2, -0.02, 0)
    head.add(snout)

    const brow = shaded(new THREE.SphereGeometry(0.06, 8, 6), dark)
    brow.scale.set(1.4, 0.45, 0.8)
    brow.position.set(0.06, 0.12, 0)
    head.add(brow)

    this.jaw.position.set(0.16, -0.08, 0)
    const jawMesh = shaded(new THREE.SphereGeometry(0.09, 10, 8), bellyMat)
    jawMesh.scale.set(1.3, 0.45, 0.7)
    jawMesh.position.x = 0.06
    this.jaw.add(jawMesh)
    head.add(this.jaw)

    this.eyes.position.set(0.1, 0.05, 0)
    const eyeL = eye(0.07)
    const eyeR = eye(-0.07)
    this.eyes.add(eyeL, eyeR)
    head.add(this.eyes)

    const nostrilL = shaded(new THREE.SphereGeometry(0.018, 6, 5), dark)
    const nostrilR = nostrilL.clone()
    nostrilL.position.set(0.34, 0.0, 0.045)
    nostrilR.position.set(0.34, 0.0, -0.045)
    head.add(nostrilL, nostrilR)

    for (let i = 0; i < 5; i += 1) {
      const spike = shaded(new THREE.ConeGeometry(0.035, 0.11, 4), dark)
      spike.position.set(-0.05 + i * 0.1, 0.36 - i * 0.02, 0)
      spike.rotation.z = 0.35
      this.torso.add(spike)
    }

    this.tail1.position.set(-0.22, 0.1, 0)
    const t1 = shaded(new THREE.CapsuleGeometry(0.1, 0.18, 3, 8), skin)
    t1.rotation.z = Math.PI / 2
    t1.position.x = -0.12
    this.tail1.add(t1)
    this.tail2.position.set(-0.22, -0.01, 0)
    const t2 = shaded(new THREE.CapsuleGeometry(0.075, 0.16, 3, 8), skin)
    t2.rotation.z = Math.PI / 2
    t2.position.x = -0.1
    this.tail2.add(t2)
    this.tail3.position.set(-0.2, -0.02, 0)
    const t3 = shaded(new THREE.CapsuleGeometry(0.05, 0.14, 2, 6), skin)
    t3.rotation.z = Math.PI / 2
    t3.position.x = -0.08
    this.tail3.add(t3)
    this.tail2.add(this.tail3)
    this.tail1.add(this.tail2)
    this.torso.add(this.tail1)

    this.armL.position.set(0.34, 0.12, 0.16)
    this.armR.position.set(0.34, 0.12, -0.16)
    this.torso.add(this.armL, this.armR)

    this.shinL.position.y = -THIGH
    this.shinR.position.y = -THIGH
    this.thighL.add(this.shinL)
    this.thighR.add(this.shinR)
    this.footL.position.y = -SHIN
    this.footR.position.y = -SHIN
    this.shinL.add(this.footL)
    this.shinR.add(this.footR)
    this.footL.add(footMesh())
    this.footR.add(footMesh())

    this.thighL.position.set(0.06, HIP, 0.12)
    this.thighR.position.set(0.06, HIP, -0.12)
    this.body.add(this.thighL, this.thighR)
    this.torso.position.y = HIP
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

function footMesh(): THREE.Group {
  const group = new THREE.Group()
  const sole = shaded(new THREE.CapsuleGeometry(0.045, 0.14, 2, 6), skin)
  sole.rotation.z = Math.PI / 2
  sole.position.x = 0.08
  group.add(sole)
  for (let i = 0; i < 3; i += 1) {
    const claw = shaded(new THREE.ConeGeometry(0.018, 0.07, 4), horn)
    claw.rotation.z = -Math.PI / 2
    claw.position.set(0.18, -0.01, (i - 1) * 0.035)
    group.add(claw)
  }
  return group
}

function eye(z: number): THREE.Group {
  const group = new THREE.Group()
  const white = shaded(new THREE.SphereGeometry(0.045, 10, 8), eyeWhite)
  white.scale.z = 0.7
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), pupilMat)
  pupil.position.set(0.03, 0, 0)
  const glint = new THREE.Mesh(
    new THREE.SphereGeometry(0.008, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  )
  glint.position.set(0.04, 0.012, 0.008)
  group.add(white, pupil, glint)
  group.position.set(0.08, 0.02, z)
  return group
}
