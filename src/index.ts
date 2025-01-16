import Alpine from 'alpinejs'
import 'katex/dist/katex.min.css'
import renderMathInElement from 'katex/contrib/auto-render'
import _ky from 'ky'
import { z } from 'zod'

const PROVER_URL = 'http://localhost:3000'
const NOTIFICATION_URL = 'http://localhost:8787'

// override ky
const ky = _ky.create({
  retry: { methods: ['post'] },
})

Alpine.data('prover', () => ({
  formula: '',
  lang: 'kotlin',
  timeout: 3,
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
      // close details if open
      const details = document.querySelector('details')!
      details.open = false
      window.scrollTo({ top: 0, behavior: 'smooth' })
      // set status
      this.status = 'Proving'
      // set loading true
      this.isLoading = true
      // clear result
      this.result = ''
      // update url
      history.pushState({}, '', `?formula=${encodeURIComponent(this.formula)}`)
      // create form data
      const formData = new FormData(document.querySelector('form')!)
      // notify
      const preNotification = [...formData]
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
      ky.post(`${NOTIFICATION_URL}/text`, {
        body: preNotification,
      })
      console.debug(preNotification)
      // prove
      const response = await ky.post(PROVER_URL, {
        body: formData,
        timeout: this.timeout * 1000 + 5000,
      })
      // get json
      const json = await response.json()
      // parse json
      const { text, bussproofs, ebproof } = z
        .object({
          text: z.string(),
          bussproofs: z.string().optional(),
          ebproof: z.string().optional(),
        })
        .parse(json)
      // notify
      const postNotification = `text: ${text}\n${bussproofs ? 'bussproofs' : ''}\n${ebproof ? 'ebproof' : ''}`
      ky.post(`${NOTIFICATION_URL}/text`, {
        body: postNotification,
      })
      console.log(postNotification)
      // set result
      this.result += text
      // notify
      if (bussproofs) {
        ky.post(`${NOTIFICATION_URL}/tex-to-png`, { body: bussproofs })
      }
      if (ebproof) {
        ky.post(`${NOTIFICATION_URL}/tex-to-png`, { body: ebproof })
      }
      // set status
      this.status = 'Generating SVG'
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (e) {
      // notify
      ky.post(`${NOTIFICATION_URL}/text`, {
        body: `Browser: Unexpected error: ${e}`,
      })
      console.error(e)
      this.result += 'Failed: Unexpected error\n'
    } finally {
      this.status = 'Prove'
      this.isLoading = false
    }
  },
}))

Alpine.start()
