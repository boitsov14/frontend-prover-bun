const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T
const textarea = $<HTMLTextAreaElement>('formula')
const prove = $<HTMLButtonElement>('prove')

// set formula from url parameter to textarea
document.addEventListener('DOMContentLoaded', () => {
  // get formula from url parameter
  const formula = new URLSearchParams(location.search).get('formula')
  if (formula) {
    // set formula to textarea
    textarea.value = decodeURIComponent(formula)
  }
})

// set event listener to each formula link that sets formula to textarea and submits form
for (const el of document.querySelectorAll('a[data-formula]')) {
  el.addEventListener('click', () => {
    // set formula to textarea
    textarea.value = el.getAttribute('data-formula')!
    // submit form
    prove.click()
  })
}

// set event listener to form that sends formula to server
document.querySelector('form')!.addEventListener('submit', event => {
  event.preventDefault()
  // get formula from textarea
  const formula = textarea.value
  // update url
  history.pushState({}, '', `?formula=${encodeURIComponent(formula)}`)
  // create form data
  const formData = new FormData(event.target as HTMLFormElement)
  // set aria-busy
  prove.setAttribute('aria-busy', 'true')
  // TODO: 後で消す
  formData.forEach((value, key) => {
    // biome-ignore lint/suspicious/noConsoleLog:
    console.log(`${key}: ${value}`)
  })
})
