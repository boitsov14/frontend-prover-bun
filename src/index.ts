const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T

document.addEventListener('DOMContentLoaded', () => {
  // get formula from url parameter
  const formula = new URLSearchParams(location.search).get('formula')
  if (formula) {
    // set formula to textarea
    $<HTMLTextAreaElement>('formula').value = decodeURIComponent(formula)
  }
})

for (const el of document.querySelectorAll('a[data-formula]')) {
  el.addEventListener('click', () => {
    // set formula to textarea
    $<HTMLTextAreaElement>('formula').value = el.getAttribute('data-formula')!
    // submit form
    $<HTMLButtonElement>('prove').click()
  })
}

$('prover-form').addEventListener('submit', event => {
  event.preventDefault()
  // get formula from textarea
  const formula = $<HTMLTextAreaElement>('formula').value
  // update url
  history.pushState({}, '', `?formula=${encodeURIComponent(formula)}`)
  // create form data
  const formData = new FormData(event.target as HTMLFormElement)
  // set aria-busy
  $<HTMLButtonElement>('prove').setAttribute('aria-busy', 'true')
  // TODO: 後で消す
  formData.forEach((value, key) => {
    // biome-ignore lint/suspicious/noConsoleLog:
    console.log(`${key}: ${value}`)
  })
})
