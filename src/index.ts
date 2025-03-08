import Alpine from 'alpinejs'
import 'katex/dist/katex.min.css'
import Panzoom from '@panzoom/panzoom'
import katex from 'katex'
import renderMathInElement from 'katex/contrib/auto-render'
import _ky from 'ky'
import { z } from 'zod'
import { LATEX_URL, NOTIFICATION_URL, PROVER_URL } from './config.ts'

// override ky
const ky = _ky.create({
  // enable retry for post
  retry: { methods: ['post'] },
  // console debug request body before sending
  hooks: {
    beforeRequest: [
      async request => {
        // only for notification text
        if (request.url === `${NOTIFICATION_URL}/text`) {
          try {
            // biome-ignore lint/suspicious/noConsole:
            console.debug(await request.clone().text())
          } catch (e) {
            // biome-ignore lint/suspicious/noConsole:
            console.error(e)
          }
        }
      },
    ],
  },
})

Alpine.data('prover', () => ({
  // initial values
  formula: '',
  lang: 'kotlin',
  sequent: true,
  tableau: true,
  bussproofs: true,
  ebproof: false,
  timeout: 3,
  debug: false,
  button: 'Prove',
  isLoading: false,
  parsedFormula: '',
  result: '',
  proofs: [] as [string, string, string][],
  downloadingData: '',
  downloadingType: '',

  init() {
    // render KaTeX
    renderMathInElement(document.body, {
      // use $...$ as inline math
      delimiters: [{ left: '$', right: '$', display: false }],
      // not throw error
      throwOnError: false,
    })
    // get formula from url parameter
    const formula = new URLSearchParams(location.search).get('formula')
    // set formula
    if (formula) {
      this.formula = decodeURIComponent(formula)
    }
  },

  proveFormula(formula: string) {
    // set formula
    this.formula = formula
    // submit form
    this.prove()
  },

  async prove() {
    try {
      // close options
      document.querySelector('details')!.open = false
      // scroll to top smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' })
      // set button text
      this.button = 'Proving'
      // set loading true
      this.isLoading = true
      // clear result
      this.parsedFormula = ''
      this.result = ''
      this.proofs = []
      // update url
      history.pushState({}, '', `?formula=${encodeURIComponent(this.formula)}`)
      // create json
      const json =
        this.lang === 'rust'
          ? {
              formula: this.formula,
              timeout: this.timeout,
              sequent: this.sequent,
              tableau: this.tableau,
              debug: this.debug,
            }
          : {
              formula: this.formula,
              timeout: this.timeout,
              bussproofs: this.bussproofs,
              ebproof: this.ebproof,
            }
      // notify
      ky.post(`${NOTIFICATION_URL}/text`, {
        body: JSON.stringify({ lang: this.lang, ...json }, null, 4),
      })
      // prove
      const response = await ky
        .post(PROVER_URL, {
          json: json,
          timeout: this.timeout * 1000 + 5000,
        })
        .json()
      // parse response
      const { text, formula, proofs } = z
        .object({
          text: z.string(),
          formula: z.string().optional(),
          proofs: z.record(z.string()),
        })
        .parse(response)
      // notify text
      ky.post(`${NOTIFICATION_URL}/text`, { body: text })
      // set result
      this.result += text
      // set parsed formula
      if (formula) {
        // replace \fCenter with \vdash
        // render KaTeX
        this.parsedFormula = katex.renderToString(
          formula.replaceAll('\\fCenter', '\\vdash'),
          {
            throwOnError: false,
          },
        )
      }
      // notify tex
      for (const tex of Object.values(proofs)) {
        ky.post(`${NOTIFICATION_URL}/tex-to-png`, { body: tex })
      }
      // set button
      this.button = 'Generating SVG'
      // generate SVG concurrently
      await Promise.allSettled(
        Object.entries(proofs).map(([type, tex]) =>
          this.generateSvg(type, tex),
        ),
      )
      // notify
      ky.post(`${NOTIFICATION_URL}/text`, { body: 'Done' })
    } catch (e) {
      // notify
      ky.post(`${NOTIFICATION_URL}/text`, {
        body: `Browser: Unexpected error: ${e}`,
      })
      // set error
      this.result += 'Failed: Unexpected error\n'
    } finally {
      // reset button text
      this.button = 'Prove'
      // reset loading false
      this.isLoading = false
      // add panzoom to SVG
      for (const elem of document.getElementsByTagName('svg')) {
        const panzoom = Panzoom(elem, {
          maxScale: Number.POSITIVE_INFINITY,
          step: 1,
          pinchAndPan: true,
          contain: 'outside',
        })
        // enable wheel zoom
        elem.addEventListener('wheel', panzoom.zoomWithWheel)
      }
      // scroll to result smoothly
      document.getElementById('result')!.scrollIntoView({ behavior: 'smooth' })
    }
  },

  async generateSvg(type: string, tex: string): Promise<void> {
    let result = `Start Generating SVG (${type}):\n`
    // generate SVG
    const response = await ky.post(`${LATEX_URL}/svg`, { body: tex })
    // check Content-Type is SVG
    if (response.headers.get('Content-Type') === 'image/svg+xml') {
      const svg = await response.text()
      this.proofs.push([type, tex, svg])
      result += 'Success'
      // notify result
      ky.post(`${NOTIFICATION_URL}/text`, { body: result })
    } else {
      result += await response.text()
      this.result += result
      // notify
      ky.post(`${NOTIFICATION_URL}/text`, { body: result })
    }
  },

  downloadSvg(svg: string) {
    this.downloadingData = svg
    this.downloadingType = 'svg'
    const blob = new Blob([svg])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'proof.svg'
    a.click()
    URL.revokeObjectURL(url)
    this.downloadingData = ''
    this.downloadingType = ''
  },

  downloadTex(tex: string) {
    this.downloadingData = tex
    this.downloadingType = 'tex'
    const blob = new Blob([tex])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'proof.tex'
    a.click()
    URL.revokeObjectURL(url)
    this.downloadingData = ''
    this.downloadingType = ''
  },

  async downloadPng(tex: string) {
    this.downloadingData = tex
    this.downloadingType = 'png'
    this.result += 'Downloading PNG\n'
    try {
      const response = await ky.post(`${LATEX_URL}/png`, {
        body: tex,
      })
      // check Content-Type
      if (response.headers.get('Content-Type') !== 'image/png') {
        throw new Error('Invalid response type')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'proof.png'
      a.click()
      URL.revokeObjectURL(url)
      this.result += 'Success\n'
    } catch (e) {
      // notify
      ky.post(`${NOTIFICATION_URL}/text`, {
        body: `Browser: Unexpected error: ${e}`,
      })
      this.result += 'Failed: Unexpected error\n'
    } finally {
      this.downloadingData = ''
      this.downloadingType = ''
    }
  },

  async downloadPdf(tex: string) {
    this.downloadingData = tex
    this.downloadingType = 'pdf'
    this.result += 'Downloading PDF\n'
    try {
      const response = await ky.post(`${LATEX_URL}/pdf`, { body: tex })
      // check Content-Type
      if (response.headers.get('Content-Type') !== 'application/pdf') {
        throw new Error('Invalid response type')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'proof.pdf'
      a.click()
      URL.revokeObjectURL(url)
      this.result += 'Success\n'
    } catch (e) {
      // notify
      ky.post(`${NOTIFICATION_URL}/text`, {
        body: `Browser: Unexpected error: ${e}`,
      })
      this.result += 'Failed: Unexpected error\n'
    } finally {
      this.downloadingData = ''
      this.downloadingType = ''
    }
  },
}))

Alpine.start()
