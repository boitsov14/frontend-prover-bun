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
  lang: 'kotlin',
  status: 'Prove',
  isLoading: false,
  result: '',

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
    try {
      this.status = 'Proving'
      this.isLoading = true
      this.result = 'Proving...\n'
      // update url
      history.pushState({}, '', `?formula=${encodeURIComponent(this.formula)}`)
      // create form data
      const formData = new FormData(document.querySelector('form')!)
      // TODO: 後で消す
      // formData.forEach((value, key) => {
      //   console.log(`${key}: ${value}`)
      // })
      // notify
      ky.post(NOTIFICATION_URL, { body: formData })
      // prove
      const response = await ky.post(PROVER_URL, { body: formData })
      // if content type is text/plain
      if (response.headers.get('content-type') === 'text/plain') {
        const text = await response.text()
        this.result += text
        return
      }
      // const json = await response.json()
      await new Promise(resolve => setTimeout(resolve, 1000))
      this.result += 'Proved\n'
      this.status = 'Generating SVG'
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (e) {
      // notify
      ky.post(NOTIFICATION_URL, { body: `${e}` })
      this.result += 'Failed: Unexpected error\n'
    } finally {
      this.status = 'Prove'
      this.isLoading = false
    }
  },
}))

Alpine.start()
