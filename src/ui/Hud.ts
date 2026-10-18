import { t } from '../i18n'

export type HudMode = 'waiting' | 'running' | 'crashed'

export class Hud {
  private readonly root: HTMLElement
  private readonly scoreEl: HTMLElement
  private readonly hiEl: HTMLElement
  private readonly titleEl: HTMLElement
  private readonly hintEl: HTMLElement
  private readonly flashEl: HTMLElement
  private readonly swapEl: HTMLElement

  constructor() {
    const root = document.getElementById('hud')
    const score = document.getElementById('score')
    const hi = document.getElementById('hi')
    const title = document.getElementById('title')
    const hint = document.getElementById('hint')
    const flash = document.getElementById('flash')
    const swap = document.getElementById('swap')
    if (!root || !score || !hi || !title || !hint || !flash || !swap) {
      throw new Error('HUD incompleto')
    }
    this.root = root
    this.scoreEl = score
    this.hiEl = hi
    this.titleEl = title
    this.hintEl = hint
    this.flashEl = flash
    this.swapEl = swap
  }

  render(mode: HudMode, score: number, high: number, night: boolean, flashScore: boolean): void {
    this.root.className = night ? `${mode} night` : mode
    this.scoreEl.textContent = digits(score)
    this.hiEl.textContent = high > 0 ? `HI ${digits(high)}` : ''
    this.swapEl.textContent = t('swap')
    if (mode === 'waiting') {
      this.titleEl.textContent = t('startTitle')
      this.hintEl.textContent = t('startHint')
    } else if (mode === 'crashed') {
      this.titleEl.textContent = t('gameOver')
      this.hintEl.textContent = t('restartHint')
    }
    if (flashScore) {
      this.scoreEl.classList.remove('flash')
      void this.scoreEl.offsetWidth
      this.scoreEl.classList.add('flash')
    }
  }

  hitFlash(): void {
    this.flashEl.classList.remove('on')
    void this.flashEl.offsetWidth
    this.flashEl.classList.add('on')
  }
}

function digits(value: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(5, '0')
}
