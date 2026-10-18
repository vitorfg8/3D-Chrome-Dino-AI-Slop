import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { SPECIES, type SpeciesId } from './species'
import { makeEye } from '../entities/eyes'

const PTERO_SPAN = 1.35

export interface ModelLibrary {
  dinos: Record<SpeciesId, GLTF>
  cactusSmall: THREE.Object3D
  cactusLarge: THREE.Object3D
  scenery: THREE.Object3D[]
  pterosaur: THREE.Object3D
}

export async function loadModels(): Promise<ModelLibrary> {
  const loader = new GLTFLoader()
  const load = (file: string) => loader.loadAsync(`/models/${file}`)
  const [dinos, small, large, barrel, round, flowers, pterosaur] = await Promise.all([
    Promise.all(SPECIES.map(async (species) => [species.id, await load(species.file)] as const)),
    load('cactus-small.glb'),
    load('cactus-large.glb'),
    load('cactus-barrel.glb'),
    load('cactus-round.glb'),
    load('cactus-flowers.glb'),
    load('pterosaur.glb'),
  ])

  return {
    dinos: Object.fromEntries(dinos) as Record<SpeciesId, GLTF>,
    cactusSmall: prepareProp(small.scene, 0.92),
    cactusLarge: prepareProp(large.scene, 1.5),
    pterosaur: preparePterosaur(pterosaur.scene),
    scenery: [
      prepareProp(large.scene, 1.7),
      prepareProp(barrel.scene, 0.85),
      prepareProp(round.scene, 1.15),
      prepareProp(flowers.scene, 0.7),
      prepareProp(small.scene, 0.8),
    ],
  }
}

function prepareProp(source: THREE.Object3D, height: number): THREE.Group {
  const inner = source.clone(true)
  inner.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) material.side = THREE.DoubleSide
    }
  })
  const holder = new THREE.Group()
  holder.add(inner)
  holder.updateMatrixWorld(true)
  const size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3())
  const footprint = Math.max(size.x, size.z)
  if (size.y < footprint * 0.45) inner.rotation.x = -Math.PI / 2
  holder.updateMatrixWorld(true)
  const measured = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3())
  holder.scale.setScalar(height / Math.max(measured.y, 0.001))
  holder.updateMatrixWorld(true)
  const grounded = new THREE.Box3().setFromObject(holder)
  inner.position.y -= grounded.min.y / holder.scale.y
  inner.position.x -= (grounded.min.x + grounded.max.x) / (2 * holder.scale.x)
  inner.position.z -= (grounded.min.z + grounded.max.z) / (2 * holder.scale.z)
  return holder
}

function preparePterosaur(source: THREE.Object3D): THREE.Group {
  const body = source.getObjectByName('body')
  const wingA = source.getObjectByName('wingA')
  const wingB = source.getObjectByName('wingB')
  if (!body || !wingA || !wingB) throw new Error('Pterossauro incompleto')
  for (const part of [body, wingA, wingB]) styleFlat(part)

  const spin = new THREE.Group()
  spin.rotation.y = Math.PI
  spin.add(body, wingA, wingB)
  const template = new THREE.Group()
  template.add(spin)

  spin.updateMatrixWorld(true)
  const bodyCenter = new THREE.Box3().setFromObject(body).getCenter(new THREE.Vector3())
  hingeWing(spin, wingA, bodyCenter)
  hingeWing(spin, wingB, bodyCenter)

  spin.updateMatrixWorld(true)
  const span = new THREE.Box3().setFromObject(spin).getSize(new THREE.Vector3())
  spin.scale.setScalar(PTERO_SPAN / Math.max(span.x, span.z, 0.001))
  spin.updateMatrixWorld(true)
  const mid = new THREE.Box3().setFromObject(body).getCenter(new THREE.Vector3())
  spin.position.sub(mid)
  spin.updateMatrixWorld(true)
  attachPteroEyes(body)

  const fitted = new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3())
  template.userData.hitW = fitted.x * 0.72
  template.userData.hitH = fitted.y * 0.62
  return template
}

function styleFlat(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const cloned = source.map((material) => {
      const copy = material.clone()
      if (copy instanceof THREE.MeshStandardMaterial) {
        copy.flatShading = true
        copy.side = THREE.DoubleSide
        copy.metalness = 0
        copy.roughness = 1
      }
      return copy
    })
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]
  })
}

function hingeWing(parent: THREE.Group, wing: THREE.Object3D, bodyCenter: THREE.Vector3): void {
  const joint = nearestVertex(wing, bodyCenter)
  const tip = new THREE.Box3().setFromObject(wing).getCenter(new THREE.Vector3())
  const pivot = new THREE.Group()
  pivot.name = tip.x >= bodyCenter.x ? 'wingR' : 'wingL'
  parent.add(pivot)
  parent.updateMatrixWorld(true)
  pivot.position.copy(parent.worldToLocal(joint.clone()))
  pivot.updateMatrixWorld(true)
  pivot.attach(wing)
}

function nearestVertex(root: THREE.Object3D, target: THREE.Vector3): THREE.Vector3 {
  const best = new THREE.Vector3()
  const point = new THREE.Vector3()
  let bestD = Infinity
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const position = mesh.geometry.attributes.position
    const step = Math.max(1, Math.floor(position.count / 400))
    for (let i = 0; i < position.count; i += step) {
      point.fromBufferAttribute(position, i)
      mesh.localToWorld(point)
      const distance = point.distanceToSquared(target)
      if (distance < bestD) {
        bestD = distance
        best.copy(point)
      }
    }
  })
  return best
}

function attachPteroEyes(body: THREE.Object3D): void {
  body.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(body)
  const size = box.getSize(new THREE.Vector3())
  const front = box.min.x + size.x * 0.32
  const high = box.min.y + size.y * 0.48
  const point = new THREE.Vector3()
  let surface = -Infinity
  let eyeX = box.min.x + size.x * 0.2
  let eyeY = box.max.y - size.y * 0.22
  let found = false
  body.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const position = mesh.geometry.attributes.position
    const step = Math.max(1, Math.floor(position.count / 500))
    for (let i = 0; i < position.count; i += step) {
      point.fromBufferAttribute(position, i)
      mesh.localToWorld(point)
      if (point.x > front || point.y < high) continue
      found = true
      if (point.z > surface) {
        surface = point.z
        eyeX = point.x
        eyeY = point.y
      }
    }
  })
  if (!found) return
  const worldScale = Math.abs(body.getWorldScale(new THREE.Vector3()).x) || 1
  const worldRadius = Math.min(size.y * 0.2, 0.06)
  const radius = worldRadius / worldScale
  const spot = new THREE.Vector3(eyeX, eyeY, surface + worldRadius * 0.35)
  const origin = new THREE.Vector3()
  body.getWorldPosition(origin)
  const ahead = body.worldToLocal(origin.clone().add(new THREE.Vector3(0, 0, 1)))
  const here = body.worldToLocal(origin.clone())
  const pupil = ahead.sub(here).normalize().multiplyScalar(radius * 0.7)
  const eye = makeEye(radius, pupil)
  body.add(eye)
  eye.position.copy(body.worldToLocal(spot))
  eye.scale.set(1, 1, 1)
  eye.name = 'eye'
}
