import { getLocale, LOCALES, onLocale, setLocale, t, type Locale } from '../i18n'

const NAMES: Record<Locale, string> = {
  'pt-BR': 'Português',
  es: 'Español',
  en: 'English',
}

export class LangMenu {
  private readonly toggle: HTMLButtonElement
  private readonly panel: HTMLElement

  constructor() {
    const root = document.createElement('div')
    root.id = 'lang'
    this.toggle = document.createElement('button')
    this.toggle.type = 'button'
    this.toggle.id = 'lang-toggle'
    this.panel = document.createElement('div')
    this.panel.id = 'lang-panel'
    this.panel.hidden = true
    for (const locale of LOCALES) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.lang = locale
      button.textContent = NAMES[locale]
      button.addEventListener('click', () => {
        setLocale(locale)
        this.panel.hidden = true
      })
      this.panel.append(button)
    }
    this.toggle.addEventListener('click', () => {
      this.panel.hidden = !this.panel.hidden
      this.mark()
    })
    root.append(this.toggle, this.panel)
    document.body.append(root)
    onLocale(() => this.refresh())
    this.refresh()
  }

  private refresh(): void {
    this.toggle.textContent = t('language')
    this.mark()
  }

  private mark(): void {
    const current = getLocale()
    for (const button of this.panel.querySelectorAll<HTMLButtonElement>('[data-lang]')) {
      button.classList.toggle('is-selected', button.dataset.lang === current)
    }
  }
}
