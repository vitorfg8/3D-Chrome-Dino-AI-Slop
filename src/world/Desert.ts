import * as THREE from 'three'
const PERIOD = 40

interface Prop {
  mesh: THREE.Object3D
  x: number
  span: number
  factor: number
}

interface Dust {
  mesh: THREE.Mesh
  mat: THREE.MeshBasicMaterial
  vx: number
  vy: number
  life: number
  max: number
}

export class Desert {
  private readonly props: Prop[] = []
  private readonly dust: Dust[] = []
  private readonly sky: THREE.ShaderMaterial
  private readonly stars: THREE.Points
  private readonly starMat: THREE.PointsMaterial
  private readonly sun: THREE.Mesh
  private readonly sunGlow: THREE.Sprite
  private readonly moon: THREE.Mesh
  private readonly moonMat: THREE.MeshBasicMaterial
  private readonly ground: THREE.Mesh
  private readonly fog: THREE.Fog
  private offset = 0
  private emitAcc = 0

  private readonly dayTop = new THREE.Color('#6eb6ef')
  private readonly nightTop = new THREE.Color('#070b16')
  private readonly dayHorizon = new THREE.Color('#f2d2a4')
  private readonly nightHorizon = new THREE.Color('#1a243c')
  private readonly dayBottom = new THREE.Color('#e4c196')
  private readonly nightBottom = new THREE.Color('#12151c')

  constructor(
    private readonly scene: THREE.Scene,
    private readonly scenery: THREE.Object3D[],
  ) {
    this.sky = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: this.dayTop.clone() },
        horizonColor: { value: this.dayHorizon.clone() },
        bottomColor: { value: this.dayBottom.clone() },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        void main() {
          float h = normalize(vPos).y;
          vec3 col = mix(horizonColor, topColor, smoothstep(0.0, 0.62, h));
          col = mix(bottomColor, col, smoothstep(-0.25, 0.08, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
    const dome = new THREE.Mesh(new THREE.SphereGeometry(140, 28, 16), this.sky)
    dome.renderOrder = -20
    dome.frustumCulled = false
    scene.add(dome)

    const starGeo = new THREE.BufferGeometry()
    const starPos: number[] = []
    for (let i = 0; i < 220; i += 1) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.45
      const r = 78
      starPos.push(Math.cos(theta) * Math.cos(phi) * r, Math.sin(phi) * r + 4, Math.sin(theta) * Math.cos(phi) * r)
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    this.starMat = new THREE.PointsMaterial({
      color: 0xeef3ff,
      size: 0.45,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      sizeAttenuation: true,
    })
    this.stars = new THREE.Points(starGeo, this.starMat)
    this.stars.renderOrder = -10
    scene.add(this.stars)

    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false, toneMapped: false })
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(2.4, 20, 16), sunMat)
    scene.add(this.sun)
    const glow = glowTexture('#ffe1a3')
    const glowMat = new THREE.SpriteMaterial({
      map: glow,
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    this.sunGlow = new THREE.Sprite(glowMat)
    this.sunGlow.scale.set(8, 8, 1)
    scene.add(this.sunGlow)

    this.moonMat = new THREE.MeshBasicMaterial({
      color: 0xdbe6ff,
      fog: false,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    })
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 16), this.moonMat)
    scene.add(this.moon)

    this.fog = new THREE.Fog(this.dayHorizon.getHex(), 20, 66)
    scene.fog = this.fog

    this.ground = this.buildGround()
    scene.add(this.ground)
    this.scatter()
    this.buildDust()
    this.setNight(0)
  }

  update(dt: number, speed: number): void {
    this.offset += speed * dt
    this.ground.position.x = -(this.offset % PERIOD)
    for (const prop of this.props) {
      const rate = prop.factor < 1 ? Math.max(speed, 0.7) * prop.factor : speed * prop.factor
      prop.x -= rate * dt
      if (prop.x < -30) prop.x += prop.span
      prop.mesh.position.x = prop.x
    }
    for (const mote of this.dust) {
      if (mote.life <= 0) continue
      mote.life -= dt
      mote.mesh.position.x += mote.vx * dt
      mote.mesh.position.y += mote.vy * dt
      mote.vy -= 1.4 * dt
      const t = Math.max(0, mote.life / mote.max)
      mote.mat.opacity = 0.45 * t
      mote.mesh.scale.setScalar(0.7 + (1 - t) * 0.8)
      if (mote.life <= 0) mote.mesh.visible = false
    }
  }

  setNight(t: number): void {
    const top = this.sky.uniforms.topColor.value as THREE.Color
    const horizon = this.sky.uniforms.horizonColor.value as THREE.Color
    const bottom = this.sky.uniforms.bottomColor.value as THREE.Color
    top.copy(this.dayTop).lerp(this.nightTop, t)
    horizon.copy(this.dayHorizon).lerp(this.nightHorizon, t)
    bottom.copy(this.dayBottom).lerp(this.nightBottom, t)
    this.fog.color.copy(horizon)

    this.sun.position.set(
      THREE.MathUtils.lerp(8, -16, t),
      THREE.MathUtils.lerp(10.5, -5, t),
      -18,
    )
    this.sun.visible = this.sun.position.y > 1
    this.sunGlow.position.copy(this.sun.position)
    this.sunGlow.visible = this.sun.visible
    ;(this.sunGlow.material as THREE.SpriteMaterial).opacity = this.sun.visible ? 0.9 : 0

    this.moon.position.set(5, THREE.MathUtils.lerp(-8, 9.2, t), -18)
    this.moonMat.opacity = THREE.MathUtils.smoothstep(t, 0.2, 0.7)
    this.starMat.opacity = THREE.MathUtils.smoothstep(t, 0.35, 0.85)
  }

  puff(x: number, speed: number, dt: number): void {
    this.emitAcc += dt * (8 + speed * 0.3)
    while (this.emitAcc >= 1) {
      this.emitAcc -= 1
      this.kick(x - 0.25, 0.55 + Math.random() * 0.8, 0.4 + Math.random())
    }
  }

  burst(x: number, strength = 1): void {
    for (let i = 0; i < 10; i += 1) {
      this.kick(x, 1.4 * strength + Math.random(), (Math.random() - 0.2) * 2.4 * strength)
    }
  }

  private kick(x: number, vy: number, vxBias: number): void {
    const mote = this.dust.find((item) => item.life <= 0)
    if (!mote) return
    mote.life = mote.max = 0.28 + Math.random() * 0.28
    mote.mesh.visible = true
    mote.mesh.position.set(x + (Math.random() - 0.5) * 0.3, 0.06 + Math.random() * 0.05, (Math.random() - 0.5) * 0.35)
    mote.vx = -1.5 - Math.random() * 1.4 + vxBias
    mote.vy = vy
    mote.mesh.scale.setScalar(0.7)
  }

  private buildGround(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(240, 160, 80, 40)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const wave =
        Math.sin((x / PERIOD) * Math.PI * 2) * 0.07 +
        Math.sin((x / PERIOD) * Math.PI * 4 + 1.7) * 0.03 +
        Math.sin(z * 0.42) * 0.045
      const trail = Math.exp(-z * z * 0.65)
      pos.setY(i, wave * (1 - trail))
    }
    geo.computeVertexNormals()

    const tex = sandTexture()
    tex.repeat.set(60, 1)
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.96,
      metalness: 0,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.receiveShadow = true
    return mesh
  }

  private scatter(): void {
    const rand = mulberry32(11)
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a7048, roughness: 0.9, flatShading: true })
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0xa85a3c, roughness: 0.88, flatShading: true })
    const farMat = new THREE.MeshStandardMaterial({ color: 0x8d7360, roughness: 0.95, flatShading: true })
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x6a7044, roughness: 0.9, flatShading: true })
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xfff8f0,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: true,
    })

    this.addRock(1.1, 0.7, 4.2, 2.5, rockMat, true)
    this.addRock(0.7, 0.45, -4.2, 3.1, rockMat, true)
    this.addMesa(-6, -9, 3.2, 2.4, mesaMat)
    this.addMesa(9, -11, 4.1, 3.1, mesaMat)
    this.addMesa(24, -8, 2.6, 1.8, mesaMat)

    this.placePlant(0, 6.2, -5.4, 1.15)
    this.placePlant(2, 10.4, -6.8, 0.9)

    for (let i = 0; i < 5; i += 1) {
      const x = -8 + rand() * 90
      const z = -18 - rand() * 14
      this.addMountain(x, z, 5 + rand() * 4, farMat)
    }
    for (let i = 0; i < 16; i += 1) {
      const x = -6 + rand() * 84
      const z = (rand() > 0.5 ? 1 : -1) * (1.8 + rand() * 6)
      this.addRock(0.35 + rand() * 0.7, 0.25 + rand() * 0.45, x, z, rockMat, Math.abs(z) < 5)
    }
    for (let i = 0; i < 8; i += 1) {
      const x = 12 + rand() * 70
      const z = (rand() > 0.5 ? 1 : -1) * (1.7 + rand() * 3.5)
      this.placePlant(i, x, z, 0.65 + rand() * 0.55)
    }
    for (let i = 0; i < 7; i += 1) {
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + rand() * 0.2, 0), bushMat)
      bush.scale.y = 0.55
      const x = rand() * 80
      const z = (rand() > 0.5 ? 1 : -1) * (1.6 + rand() * 4)
      bush.position.set(x, 0.12, z)
      bush.castShadow = true
      this.track(bush, x, 84, 1)
    }
    for (let i = 0; i < 6; i += 1) {
      const cloud = new THREE.Group()
      const puffs = 3 + Math.floor(rand() * 2)
      for (let p = 0; p < puffs; p += 1) {
        const blob = new THREE.Mesh(new THREE.SphereGeometry(0.7 + rand() * 0.5, 10, 8), cloudMat)
        blob.position.set(p * 0.7, rand() * 0.25, 0)
        blob.scale.y = 0.62
        cloud.add(blob)
      }
      const x = -10 + rand() * 80
      const y = 5.4 + rand() * 1.3
      const z = -4 - rand() * 8
      cloud.position.set(x, y, z)
      this.track(cloud, x, 96, 0.22)
    }
  }

  private addRock(
    radius: number,
    heightScale: number,
    x: number,
    z: number,
    material: THREE.Material,
    shadow: boolean,
  ): void {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), material)
    mesh.scale.y = heightScale / radius
    mesh.position.set(x, radius * mesh.scale.y * 0.35, z)
    mesh.rotation.y = x
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    this.track(mesh, x, 86, 1)
  }

  private addMesa(x: number, z: number, radius: number, height: number, material: THREE.Material): void {
    const group = new THREE.Group()
    const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.15, height, 7), material)
    base.position.y = height / 2
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius, height * 0.45, 6), material)
    cap.position.y = height * 0.85
    group.add(base, cap)
    group.position.set(x, 0, z)
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) mesh.castShadow = false
    })
    this.track(group, x, 90, 1)
  }

  private addMountain(x: number, z: number, radius: number, material: THREE.Material): void {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, radius * 0.9, 6), material)
    mesh.scale.set(1.7, 0.7, 1.35)
    mesh.position.set(x, radius * 0.22, z)
    mesh.rotation.y = x * 0.2
    this.track(mesh, x, 100, 1)
  }

  private placePlant(index: number, x: number, z: number, scale: number): void {
    const source = this.scenery[index % this.scenery.length]
    const plant = source.clone(true)
    plant.position.set(x, 0, z)
    plant.rotation.y = x * 1.7
    plant.scale.multiplyScalar(scale)
    this.track(plant, x, 84, 1)
  }

  private track(mesh: THREE.Object3D, x: number, span: number, factor: number): void {
    this.scene.add(mesh)
    this.props.push({ mesh, x, span, factor })
  }

  private buildDust(): void {
    const geo = new THREE.PlaneGeometry(0.16, 0.16)
    for (let i = 0; i < 24; i += 1) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xe2d0b0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: true,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      mesh.rotation.x = -0.4
      this.scene.add(mesh)
      this.dust.push({ mesh, mat, vx: 0, vy: 0, life: 0, max: 1 })
    }
  }
}

function sandTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D indisponível')
  ctx.fillStyle = '#c9a56e'
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 7000; i += 1) {
    const n = 110 + Math.random() * 90
    const y = Math.random() * size
    const trail = Math.abs(y - size * 0.5) < size * 0.07
    ctx.fillStyle = `rgba(${(n * 0.86) | 0}, ${(n * 0.68) | 0}, ${(n * 0.42) | 0}, ${trail ? 0.18 : 0.34})`
    const s = trail ? 1 : 1 + Math.random() * 2.4
    ctx.fillRect(Math.random() * size, y, s, s)
  }

  const trail = ctx.createLinearGradient(0, size * 0.42, 0, size * 0.58)
  trail.addColorStop(0, 'rgba(120, 78, 40, 0)')
  trail.addColorStop(0.35, 'rgba(120, 78, 40, 0.16)')
  trail.addColorStop(0.5, 'rgba(110, 72, 36, 0.22)')
  trail.addColorStop(0.65, 'rgba(120, 78, 40, 0.16)')
  trail.addColorStop(1, 'rgba(120, 78, 40, 0)')
  ctx.fillStyle = trail
  ctx.fillRect(0, size * 0.42, size, size * 0.16)

  for (let i = 0; i < 90; i += 1) {
    const y = Math.random() * size
    if (Math.abs(y - size * 0.5) < size * 0.06) continue
    ctx.fillStyle = Math.random() > 0.5 ? '#8a6844' : '#e4d0aa'
    ctx.beginPath()
    ctx.ellipse(Math.random() * size, y, 2 + Math.random() * 5, 1.4 + Math.random() * 2.4, Math.random(), 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.strokeStyle = 'rgba(92, 58, 28, 0.35)'
  ctx.lineWidth = 1
  for (let i = 0; i < 16; i += 1) {
    let x = Math.random() * size
    let y = Math.random() * size
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let k = 0; k < 5; k += 1) {
      x += 12 + Math.random() * 28
      y += (Math.random() - 0.5) * 14
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function glowTexture(hex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D indisponível')
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64)
  g.addColorStop(0, hex)
  g.addColorStop(0.35, 'rgba(255, 210, 140, 0.55)')
  g.addColorStop(1, 'rgba(255, 210, 140, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
