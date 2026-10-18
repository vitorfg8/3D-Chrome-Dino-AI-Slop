import * as THREE from 'three'

const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.25 })
const pupilMat = new THREE.MeshStandardMaterial({ color: 0x140e0a, roughness: 0.3 })
const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff })

export function makeEye(radius: number, pupilOffset: THREE.Vector3): THREE.Group {
  const group = new THREE.Group()
  const white = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 12), eyeWhite)
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.46, 10, 8), pupilMat)
  pupil.position.copy(pupilOffset)
  const glint = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.16, 6, 5), glintMat)
  glint.position.copy(pupilOffset).add(new THREE.Vector3(radius * 0.16, radius * 0.18, 0))
  group.add(white, pupil, glint)
  return group
}
