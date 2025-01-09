import Alpine from 'alpinejs'
import 'katex/dist/katex.min.css'
import renderMathInElement from 'katex/contrib/auto-render'
import _ky from 'ky'

const PROVER_URL = 'http://localhost:3000'
const NOTIFICATION_URL = 'http://localhost:8787/text'

// override ky
const ky = _ky.create({
  retry: { methods: ['post'] },
})

Alpine.data('prover', () => ({
  formula: '',
  isLoading: false,

  init() {
    // render KaTeX
    renderMathInElement(document.body, {
      delimiters: [{ left: '$', right: '$', display: false }],
      throwOnError: false,
    })
    // get formula from url parameter
    const formula = new URLSearchParams(location.search).get('formula')
    if (formula) {
      // set formula
      this.formula = decodeURIComponent(formula)
    }
  },

  async proveFormula(formula: string) {
    // set formula
    this.formula = formula
    // wait for DOM update
    await this.$nextTick()
    // submit form
    this.prove()
  },

  async prove() {
    this.isLoading = true
    // update url
    history.pushState({}, '', `?formula=${encodeURIComponent(this.formula)}`)
    // create form data
    const formData = new FormData(document.querySelector('form')!)
    // TODO: 後で消す
    formData.forEach((value, key) => {
      console.log(`${key}: ${value}`)
    })
    // notify
    ky.post(NOTIFICATION_URL, { body: formData })
    this.isLoading = false
  },
}))

Alpine.start()
