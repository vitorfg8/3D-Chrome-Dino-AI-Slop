import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { CONFIG, type Aabb } from '../game/config'
import type { SpeciesId } from '../assets/species'
import { makeEye } from './eyes'

const TARGET_HEIGHT = 1.65

type ClipRole = 'idle' | 'run' | 'jump' | 'dead'

export class Dino {
  readonly root = new THREE.Group()
  y = 0
  vy = 0
  onGround = true
  ducking = false
  justLanded = false
  bodyLength = 2.2

  private readonly rig = new THREE.Group()
  private readonly blob: THREE.Mesh
  private readonly blobMat: THREE.MeshBasicMaterial
  private model: THREE.Object3D | null = null
  private mixer: THREE.AnimationMixer | null = null
  private actions: Partial<Record<ClipRole, THREE.AnimationAction>> = {}
  private clipRole: ClipRole = 'idle'
  private eyes: THREE.Object3D | null = null
  private blink = 0
  private blinkTimer = 1.4
  private duckWas = false
  private dropping = false
  private pose: 'idle' | 'run' | 'jump' | 'duck' | 'crash' = 'idle'

  constructor(
    scene: THREE.Scene,
    private readonly dinos: Record<SpeciesId, GLTF>,
    species: SpeciesId,
  ) {
    this.root.add(this.rig)
    scene.add(this.root)
    this.blobMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    })
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), this.blobMat)
    this.blob.rotation.x = -Math.PI / 2
    this.blob.position.y = 0.03
    scene.add(this.blob)
    this.use(species)
  }

  use(species: SpeciesId): void {
    if (this.model) this.rig.remove(this.model)
    this.mixer?.stopAllAction()
    const gltf = this.dinos[species]
    const model = cloneSkeleton(gltf.scene)
    paint(model, species)
    const clips = gltf.animations.map((clip) => withoutRootMotion(clip.clone()))
    const mixer = new THREE.AnimationMixer(model)
    this.model = model
    this.mixer = mixer
    this.actions = {
      idle: action(mixer, clips, 'Idle'),
      run: action(mixer, clips, 'Run'),
      jump: action(mixer, clips, 'Jump'),
      dead: action(mixer, clips, 'Death') ?? action(mixer, clips, 'Idle'),
    }
    this.clipRole = 'idle'
    this.actions.idle?.play()
    mixer.update(0)
    this.rig.add(model)
    fitSkeleton(model)
    this.bodyLength = skinnedSpanX(model)
    this.eyes = attachEyes(model)
    this.rig.rotation.z = 0
    this.rig.position.y = 0
  }

  reset(): void {
    this.y = 0
    this.vy = 0
    this.onGround = true
    this.ducking = false
    this.justLanded = false
    this.pose = 'idle'
    this.duckWas = false
    this.dropping = false
    this.rig.rotation.z = 0
    this.rig.position.y = 0
    this.rig.scale.set(1, 1, 1)
    this.root.position.set(CONFIG.dinoX, 0, 0)
    this.play('idle', true)
  }

  update(dt: number, mode: 'idle' | 'run' | 'dead', jump: boolean, duck: boolean, speed: number): void {
    this.justLanded = false
    if (mode === 'dead') {
      this.pose = 'crash'
      this.ducking = false
      this.animate(dt, 0)
      this.syncShadow()
      return
    }
    if (mode === 'idle') {
      this.y = 0
      this.vy = 0
      this.onGround = true
      this.ducking = false
      this.pose = 'idle'
      this.animate(dt, 0)
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
    this.animate(dt, speed)
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

  private animate(dt: number, speed: number): void {
    const role: ClipRole =
      this.pose === 'crash' ? 'dead' : this.pose === 'jump' ? 'jump' : this.pose === 'idle' ? 'idle' : 'run'
    this.play(role, false)
    const running = this.actions.run
    if (running && role === 'run') running.timeScale = 0.8 + speed / 9
    this.mixer?.update(dt)
    const ducking = this.pose === 'duck'
    this.rig.rotation.z = 0
    this.rig.position.y = 0
    this.rig.scale.set(1, ducking ? 0.52 : 1, 1)

    this.blinkTimer -= dt
    if (this.blinkTimer <= 0 && this.pose !== 'crash') {
      this.blink = 0.09
      this.blinkTimer = 2.1 + Math.random() * 2.8
    }
    if (!this.eyes) return
    if (this.blink > 0) {
      this.blink -= dt
      this.eyes.scale.y = 0.12
    } else {
      this.eyes.scale.y = 1
    }
  }

  private play(role: ClipRole, immediate: boolean): void {
    if (this.clipRole === role && !immediate) return
    const next = this.actions[role]
    const prev = this.actions[this.clipRole]
    if (!next) return
    next.enabled = true
    next.reset()
    if (role === 'jump' || role === 'dead') {
      next.setLoop(THREE.LoopOnce, 1)
      next.clampWhenFinished = true
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity)
      next.clampWhenFinished = false
    }
    if (immediate) {
      prev?.stop()
      next.fadeIn(0).play()
    } else {
      next.fadeIn(0.12).play()
      if (prev && prev !== next) prev.fadeOut(0.12)
    }
    this.clipRole = role
  }

  private syncShadow(): void {
    const lift = Math.min(1, this.y / 1.7)
    this.blob.position.x = CONFIG.dinoX + 0.05
    this.blob.position.z = 0.02
    this.blob.scale.setScalar(1 - lift * 0.45)
    this.blobMat.opacity = 0.34 * (1 - lift * 0.75)
  }
}

function paint(model: THREE.Object3D, species: SpeciesId): void {
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const cloned = source.map((material) => {
      const copy = material.clone()
      if (species === 'trex' && copy instanceof THREE.MeshStandardMaterial) recolorTrex(copy)
      return copy
    })
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]
  })
}

function recolorTrex(material: THREE.MeshStandardMaterial): void {
  if (material.name === 'LightGreen') material.color.setHex(0x7c8b52)
  else if (material.name === 'Green') material.color.setHex(0x45502f)
  else if (material.name === 'LightYellow') material.color.setHex(0xe4d2ae)
}

function withoutRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((track) => !track.name.startsWith('Body.position'))
  return new THREE.AnimationClip(clip.name, clip.duration, tracks)
}

function action(
  mixer: THREE.AnimationMixer,
  clips: THREE.AnimationClip[],
  suffix: string,
): THREE.AnimationAction | undefined {
  const clip = clips.find((item) => item.name.endsWith(`_${suffix}`) || item.name.endsWith(suffix))
  return clip ? mixer.clipAction(clip) : undefined
}

function fitSkeleton(model: THREE.Object3D): void {
  model.rotation.set(0, 0, 0)
  model.position.set(0, 0, 0)
  model.scale.set(1, 1, 1)
  const head = model.getObjectByName('Head')
  const hips = model.getObjectByName('Hips') ?? model.getObjectByName('Body')
  let turn = Math.PI / 2
  if (head && hips) {
    const headPos = new THREE.Vector3()
    const hipPos = new THREE.Vector3()
    let best = -Infinity
    for (const candidate of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      model.rotation.y = candidate
      model.updateMatrixWorld(true)
      head.getWorldPosition(headPos)
      hips.getWorldPosition(hipPos)
      const forward = headPos.x - hipPos.x
      if (forward > best) {
        best = forward
        turn = candidate
      }
    }
  }
  model.rotation.y = turn
  model.updateMatrixWorld(true)
  const bounds = boneBounds(model)
  const height = Math.max(bounds.max.y - bounds.min.y, 0.001)
  model.scale.setScalar(TARGET_HEIGHT / height)
  model.updateMatrixWorld(true)
  const fitted = boneBounds(model)
  model.position.y -= fitted.min.y
  model.position.x -= (fitted.min.x + fitted.max.x) / 2
  model.position.z -= (fitted.min.z + fitted.max.z) / 2
  model.updateMatrixWorld(true)
  const sole = skinnedMinY(model)
  if (Number.isFinite(sole)) model.position.y -= sole
}

function skinnedSpanX(root: THREE.Object3D): number {
  const point = new THREE.Vector3()
  let min = Infinity
  let max = -Infinity
  let found = false
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    const position = mesh.geometry.attributes.position
    const step = Math.max(1, Math.floor(position.count / 800))
    for (let i = 0; i < position.count; i += step) {
      point.fromBufferAttribute(position, i)
      mesh.applyBoneTransform(i, point)
      mesh.localToWorld(point)
      found = true
      if (point.x < min) min = point.x
      if (point.x > max) max = point.x
    }
  })
  if (!found) {
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())
    return size.x
  }
  return max - min
}

function skinnedMinY(root: THREE.Object3D): number {
  const point = new THREE.Vector3()
  let min = Infinity
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    const position = mesh.geometry.attributes.position
    for (let i = 0; i < position.count; i += 1) {
      point.fromBufferAttribute(position, i)
      mesh.applyBoneTransform(i, point)
      mesh.localToWorld(point)
      if (point.y < min) min = point.y
    }
  })
  return min
}

function boneBounds(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3()
  const point = new THREE.Vector3()
  let found = false
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    if (!(obj as THREE.Bone).isBone) return
    obj.getWorldPosition(point)
    box.expandByPoint(point)
    found = true
  })
  if (!found) box.setFromObject(root)
  return box
}

function attachEyes(model: THREE.Object3D): THREE.Group | null {
  const head = model.getObjectByName('Head')
  if (!head) return null
  head.updateMatrixWorld(true)
  const origin = new THREE.Vector3()
  head.getWorldPosition(origin)
  const worldScale = Math.abs(head.getWorldScale(new THREE.Vector3()).x) || 1
  const radius = 0.11 / worldScale
  const snout = model.getObjectByName('Head_end')
  const forward = new THREE.Vector3(1, 0, 0)
  if (snout) {
    const tip = new THREE.Vector3()
    snout.getWorldPosition(tip)
    forward.copy(tip).sub(origin)
    if (forward.lengthSq() > 1e-8) forward.normalize()
  }
  const side = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0))
  if (side.lengthSq() < 1e-8) side.set(0, 0, 1)
  side.normalize()
  if (side.z < 0) side.negate()
  const eyes = new THREE.Group()
  head.add(eyes)
  const towardCamera = new THREE.Vector3(0, 0, 1)
  for (const [sign, reach] of [
    [1, 0.1],
    [-1, 0.06],
  ] as const) {
    const spot = origin.clone().addScaledVector(forward, 0.04).addScaledVector(side, reach * sign)
    spot.y += 0.03
    const eye = makeEye(radius * (sign > 0 ? 1 : 0.82), localDirection(head, towardCamera, radius * 0.7))
    eye.position.copy(head.worldToLocal(spot))
    eyes.add(eye)
    if (sign > 0) pushEyeToSurface(model, head, eye, radius)
  }
  return eyes
}

function pushEyeToSurface(
  model: THREE.Object3D,
  head: THREE.Object3D,
  eye: THREE.Object3D,
  radius: number,
): void {
  const eyeWorld = new THREE.Vector3()
  eye.getWorldPosition(eyeWorld)
  const worldRadius = radius * Math.abs(head.getWorldScale(new THREE.Vector3()).x || 1)
  const point = new THREE.Vector3()
  let surface = -Infinity
  model.updateMatrixWorld(true)
  model.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    const position = mesh.geometry.attributes.position
    const step = Math.max(1, Math.floor(position.count / 600))
    for (let i = 0; i < position.count; i += step) {
      point.fromBufferAttribute(position, i)
      mesh.applyBoneTransform(i, point)
      mesh.localToWorld(point)
      if (Math.abs(point.x - eyeWorld.x) > 0.45 || Math.abs(point.y - eyeWorld.y) > 0.35) continue
      if (point.z > surface) surface = point.z
    }
  })
  if (!Number.isFinite(surface) || surface < eyeWorld.z) return
  eyeWorld.z = surface + worldRadius * 0.35
  eye.position.copy(head.worldToLocal(eyeWorld))
}

function localDirection(head: THREE.Object3D, worldDir: THREE.Vector3, length: number): THREE.Vector3 {
  const origin = new THREE.Vector3()
  head.getWorldPosition(origin)
  const ahead = head.worldToLocal(origin.clone().add(worldDir))
  const here = head.worldToLocal(origin.clone())
  return ahead.sub(here).normalize().multiplyScalar(length)
}

