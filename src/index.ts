import Alpine from 'alpinejs'
import 'katex/dist/katex.min.css'
import renderMathInElement from 'katex/contrib/auto-render'
import _ky from 'ky'
import { z } from 'zod'

const PROVER_URL = 'http://localhost:3000'
const LATEX_URL = 'http://localhost:3001'
const NOTIFICATION_URL = 'http://localhost:8787'

// override ky
const ky = _ky.create({
  retry: { methods: ['post'] },
})

interface Request {
  formula: string
  timeout: number
  format: string[]
  debug?: boolean
}

Alpine.data('prover', () => ({
  formula: '',
  lang: 'kotlin',
  sequent: true,
  tableau: true,
  bussproofs: true,
  ebproof: false,
  timeout: 3,
  debug: false,
  status: 'Prove',
  isLoading: false,
  result: '',
  svgs: [] as string[],

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

  proveFormula(formula: string) {
    // set formula
    this.formula = formula
    // submit form
    this.prove()
  },

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity:
  async prove() {
    try {
      // close details
      document.querySelector('details')!.open = false
      // scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' })
      // set status
      this.status = 'Proving'
      // set loading true
      this.isLoading = true
      // clear result
      this.result = ''
      this.svgs = []
      // update url
      history.pushState({}, '', `?formula=${encodeURIComponent(this.formula)}`)
      // create json
      const json: Request = {
        formula: this.formula,
        timeout: this.timeout,
        format: [],
      }
      if (this.lang === 'rust') {
        if (this.sequent) {
          json.format.push('sequent')
        }
        if (this.tableau) {
          json.format.push('tableau')
        }
        json.debug = this.debug
      } else if (this.lang === 'kotlin') {
        if (this.bussproofs) {
          json.format.push('bussproofs')
        }
        if (this.ebproof) {
          json.format.push('ebproof')
        }
      }
      // notify
      const pre = JSON.stringify({ lang: this.lang, ...json }, null, 4)
      ky.post(`${NOTIFICATION_URL}/text`, { body: pre })
      console.debug(pre)
      // prove
      const response = await ky.post(PROVER_URL, {
        json: json,
        timeout: this.timeout * 1000 + 5000,
      })
      // parse json
      const { text, sequent, tableau, bussproofs, ebproof } = z
        .object({
          text: z.string(),
          sequent: z.string().optional(),
          tableau: z.string().optional(),
          bussproofs: z.string().optional(),
          ebproof: z.string().optional(),
        })
        .parse(await response.json())
      // notify
      ky.post(`${NOTIFICATION_URL}/text`, { body: text })
      console.debug(text)
      // set result
      this.result += text
      console.log(sequent)
      console.log(tableau)
      console.log(bussproofs)
      console.log(ebproof)
      // notify
      if (sequent) {
        ky.post(`${NOTIFICATION_URL}/tex-to-svg`, { body: sequent })
      }
      if (tableau) {
        ky.post(`${NOTIFICATION_URL}/tex-to-svg`, { body: tableau })
      }
      if (bussproofs) {
        ky.post(`${NOTIFICATION_URL}/tex-to-png`, { body: bussproofs })
      }
      if (ebproof) {
        ky.post(`${NOTIFICATION_URL}/tex-to-png`, { body: ebproof })
      }
      // set status
      this.status = 'Generating SVG'
      // generate SVG concurrently
      const promises = [] as Promise<void>[]
      if (sequent) {
        promises.push(this.generateSvg(sequent, 'sequent'))
      }
      if (tableau) {
        promises.push(this.generateSvg(tableau, 'tableau'))
      }
      if (bussproofs) {
        promises.push(this.generateSvg(bussproofs, 'bussproofs'))
      }
      if (ebproof) {
        promises.push(this.generateSvg(ebproof, 'ebproof'))
      }
      // wait for all promises
      await Promise.allSettled(promises)
      // notify
      ky.post(`${NOTIFICATION_URL}/text`, { body: 'Done' })
    } catch (e) {
      // notify
      ky.post(`${NOTIFICATION_URL}/text`, {
        body: `Browser: Unexpected error: ${e}`,
      })
      console.debug(`Browser: Unexpected error: ${e}`)
      this.result += 'Failed: Unexpected error\n'
    } finally {
      this.status = 'Prove'
      this.isLoading = false
    }
  },

  async generateSvg(tex: string, type: string): Promise<void> {
    const response = await ky.post(`${LATEX_URL}/svg`, { body: tex })
    let result = `Generate SVG(${type}):\n`
    if (response.headers.get('Content-Type') === 'image/svg+xml') {
      const svg = await response.text()
      this.svgs.push(svg)
      result += 'Success'
      // notify
      ky.post(`${NOTIFICATION_URL}/text`, { body: result })
      console.debug(result)
    } else {
      const error = await response.text()
      result += `${error}`
      this.result += result
      // notify
      ky.post(`${NOTIFICATION_URL}/text`, { body: result })
      console.debug(result)
    }
  },
}))

Alpine.start()
