export interface Aabb {
  x: number
  y: number
  w: number
  h: number
}

export const CONFIG = {
  gravity: 26,
  jumpVelocity: 9.9,
  fastFall: 3.15,
  initialSpeed: 7.4,
  acceleration: 0.058,
  maxSpeed: 16.2,
  scoreScale: 1.18,
  nightEvery: 700,
  blinkEvery: 100,
  pteroScore: 450,
  pteroSpeed: 9.4,
  firstDistance: 11,
  baseReaction: 1.12,
  minReaction: 0.64,
  reactionDecay: 0.032,
  gapPadding: 0.9,
  dinoX: -1.6,
  spawnX: 12.5,
  despawnX: -8.5,
  crashLock: 0.48,
  lookAt: { x: 1.9, y: 1.18, z: 0 },
  cameraDist: 13.2,
  minHalfWidth: 6.45,
  maxFov: 46,
  minFov: 26,
  smallSpacing: 0.52,
  largeSpacing: 0.72,
  smallHeight: 0.92,
  largeHeight: 1.5,
  pteroY: [0.64, 1.2, 1.95] as const,
  storageKey: 'dino-2.5d-highscore',
}

export function overlap(a: Aabb, b: Aabb): boolean {
  const pad = 0.05
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w - pad &&
    Math.abs(a.y - b.y) * 2 < a.h + b.h - pad
  )
}
