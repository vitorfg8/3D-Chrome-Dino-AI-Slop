import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { SPECIES, type SpeciesId } from './species'

export interface ModelLibrary {
  dinos: Record<SpeciesId, GLTF>
  cactusSmall: THREE.Object3D
  cactusLarge: THREE.Object3D
  scenery: THREE.Object3D[]
}

export async function loadModels(): Promise<ModelLibrary> {
  const loader = new GLTFLoader()
  const load = (file: string) => loader.loadAsync(`/models/${file}`)
  const [dinos, small, large, barrel, round, flowers] = await Promise.all([
    Promise.all(SPECIES.map(async (species) => [species.id, await load(species.file)] as const)),
    load('cactus-small.glb'),
    load('cactus-large.glb'),
    load('cactus-barrel.glb'),
    load('cactus-round.glb'),
    load('cactus-flowers.glb'),
  ])

  return {
    dinos: Object.fromEntries(dinos) as Record<SpeciesId, GLTF>,
    cactusSmall: prepareProp(small.scene, 0.92),
    cactusLarge: prepareProp(large.scene, 1.5),
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
