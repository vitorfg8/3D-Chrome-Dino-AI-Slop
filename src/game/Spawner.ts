import { CONFIG } from './config'

export type ObstacleKind = 'cactus-small' | 'cactus-large' | 'ptero'

export interface SpawnOrder {
  kind: ObstacleKind
  count: number
  lane: 0 | 1 | 2
}

export class Spawner {
  private nextDistance = CONFIG.firstDistance
  private last: ObstacleKind | null = null

  reset(): void {
    this.nextDistance = CONFIG.firstDistance
    this.last = null
  }

  pull(distance: number, speed: number, score: number, extraGap = 0): SpawnOrder | null {
    if (distance < this.nextDistance) return null
    const order = this.roll(speed, score)
    const reaction = Math.max(
      CONFIG.minReaction,
      CONFIG.baseReaction - (speed - CONFIG.initialSpeed) * CONFIG.reactionDecay,
    )
    this.nextDistance =
      distance + speed * reaction + clusterWidth(order) + CONFIG.gapPadding + extraGap
    this.last = order.kind
    return order
  }

  private roll(speed: number, score: number): SpawnOrder {
    const pteroOk = score >= CONFIG.pteroScore && speed >= CONFIG.pteroSpeed
    const r = Math.random()
    let kind: ObstacleKind
    if (pteroOk && r < 0.2) kind = 'ptero'
    else if (r < 0.62) kind = 'cactus-small'
    else kind = 'cactus-large'
    if (kind === 'ptero' && this.last === 'ptero') kind = 'cactus-small'

    if (kind === 'ptero') {
      return { kind, count: 1, lane: Math.floor(Math.random() * 3) as 0 | 1 | 2 }
    }

    const cap = kind === 'cactus-small' ? 3 : 3
    let count = 1
    if (Math.random() < 0.55) count += 1
    if (count < cap && Math.random() < (kind === 'cactus-small' ? 0.3 : 0.18)) count += 1
    return { kind, count, lane: 0 }
  }
}

export function clusterWidth(order: SpawnOrder): number {
  if (order.kind === 'ptero') return 1.15
  const spacing = order.kind === 'cactus-small' ? CONFIG.smallSpacing : CONFIG.largeSpacing
  const girth = order.kind === 'cactus-small' ? 0.36 : 0.5
  return girth + spacing * (order.count - 1)
}
