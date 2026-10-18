import * as THREE from 'three'

export function makeCactus(radius: number, height: number, material: THREE.Material): THREE.Group {
  const group = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius, height, 9), material)
  trunk.position.y = height / 2
  group.add(trunk)

  const cap = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.95, 10, 8), material)
  cap.position.y = height - radius * 0.08
  cap.scale.y = 0.7
  group.add(cap)

  addArm(group, material, radius, height, 1, 0.62, 0.05)
  addArm(group, material, radius, height, -1, 0.46, -0.06)

  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh) {
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
  })
  return group
}

function addArm(
  group: THREE.Group,
  material: THREE.Material,
  radius: number,
  height: number,
  side: number,
  heightFrac: number,
  z: number,
): void {
  const pivot = new THREE.Group()
  pivot.position.set(side * radius * 0.15, height * heightFrac, z)

  const reachLen = height * 0.2
  const reach = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, reachLen, 6),
    material,
  )
  reach.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2
  reach.position.x = (side * reachLen) / 2

  const upLen = height * 0.32
  const up = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.56, radius * 0.48, upLen, 6),
    material,
  )
  up.position.set(side * reachLen, upLen * 0.42, 0)

  const joint = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.58, 8, 6), material)
  joint.position.set(side * reachLen, 0, 0)

  const tip = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.5, 8, 6), material)
  tip.position.copy(up.position)
  tip.position.y += upLen / 2
  tip.scale.y = 0.65

  pivot.add(reach, up, joint, tip)
  group.add(pivot)
}
