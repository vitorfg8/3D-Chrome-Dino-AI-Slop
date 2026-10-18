import * as THREE from 'three'
import { CONFIG } from '../game/config'

export class Stage {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly ok: boolean
  readonly sun: THREE.DirectionalLight
  readonly hemi: THREE.HemisphereLight
  readonly fill: THREE.DirectionalLight
  readonly rim: THREE.DirectionalLight

  private readonly basePos = new THREE.Vector3()
  private readonly look = new THREE.Vector3(CONFIG.lookAt.x, CONFIG.lookAt.y, CONFIG.lookAt.z)
  private trauma = 0
  private readonly sunDay = new THREE.Color('#fff1d4')
  private readonly sunNight = new THREE.Color('#b7c6ff')
  private readonly rimDay = new THREE.Color('#ffc894')
  private readonly rimNight = new THREE.Color('#9eb4ff')
  private readonly hemiDaySky = new THREE.Color('#d5e8f8')
  private readonly hemiNightSky = new THREE.Color('#1a2744')
  private readonly hemiDayGround = new THREE.Color('#8a6844')
  private readonly hemiNightGround = new THREE.Color('#14120e')

  constructor(container: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 260)
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      })
    } catch (error) {
      container.innerHTML = '<p class="fail">WebGL não está disponível neste navegador.</p>'
      this.ok = false
      throw error
    }
    this.ok = true
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    container.appendChild(this.renderer.domElement)

    this.hemi = new THREE.HemisphereLight(this.hemiDaySky, this.hemiDayGround, 0.62)
    this.scene.add(this.hemi)

    this.sun = new THREE.DirectionalLight(this.sunDay, 4.2)
    this.sun.position.set(12, 16, 8)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.00025
    this.sun.shadow.normalBias = 0.04
    const shadow = this.sun.shadow.camera
    shadow.left = -28
    shadow.right = 28
    shadow.top = 24
    shadow.bottom = -24
    shadow.near = 0.5
    shadow.far = 72
    this.sun.target.position.set(CONFIG.lookAt.x, 0, 0)
    this.scene.add(this.sun, this.sun.target)

    this.fill = new THREE.DirectionalLight(0xc5d8ea, 0.55)
    this.fill.position.set(-2, 3, 12)
    this.scene.add(this.fill)

    this.rim = new THREE.DirectionalLight(this.rimDay, 1.15)
    this.rim.position.set(-10, 5, -8)
    this.scene.add(this.rim)

    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  resize(): void {
    const width = window.innerWidth
    const height = Math.max(1, window.innerHeight)
    const aspect = width / height
    let dist = CONFIG.cameraDist
    const tanHalf = CONFIG.minHalfWidth / (dist * Math.max(aspect, 0.35))
    let fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalf))
    if (fov > CONFIG.maxFov) {
      fov = CONFIG.maxFov
      dist = CONFIG.minHalfWidth / (Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect)
    }
    fov = THREE.MathUtils.clamp(fov, CONFIG.minFov, CONFIG.maxFov)
    this.camera.fov = fov
    this.camera.aspect = aspect
    const yLift = aspect < 0.9 ? dist * 0.028 : dist * 0.062
    this.camera.position.set(this.look.x - 0.4, this.look.y + yLift, this.look.z + dist)
    this.basePos.copy(this.camera.position)
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    this.renderer.setSize(width, height)
  }

  setNight(t: number): void {
    this.sun.color.copy(this.sunDay).lerp(this.sunNight, t)
    this.sun.intensity = THREE.MathUtils.lerp(4.3, 0.42, t)
    this.hemi.color.copy(this.hemiDaySky).lerp(this.hemiNightSky, t)
    this.hemi.groundColor.copy(this.hemiDayGround).lerp(this.hemiNightGround, t)
    this.hemi.intensity = THREE.MathUtils.lerp(0.62, 0.22, t)
    this.fill.intensity = THREE.MathUtils.lerp(0.55, 0.1, t)
    this.rim.color.copy(this.rimDay).lerp(this.rimNight, t)
    this.rim.intensity = THREE.MathUtils.lerp(1.15, 0.85, t)
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(1.12, 0.8, t)
    this.sun.position.set(THREE.MathUtils.lerp(12, -4, t), THREE.MathUtils.lerp(16, 5, t), 8)
  }

  kick(): void {
    this.trauma = 0.16
  }

  render(dt: number): void {
    this.trauma = Math.max(0, this.trauma - dt * 0.55)
    this.camera.position.copy(this.basePos)
    if (this.trauma > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.trauma
      this.camera.position.y += (Math.random() - 0.5) * this.trauma * 0.65
    }
    this.camera.lookAt(this.look)
    this.renderer.render(this.scene, this.camera)
  }
}
