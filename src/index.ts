const $ = (id: string) => document.getElementById(id)

$('prover-form')!.addEventListener('submit', event => {
  event.preventDefault()
  const formData = new FormData(event.target as HTMLFormElement)
  formData.forEach((value, key) => {
    console.log(`${key}: ${value}`)
  })
})
