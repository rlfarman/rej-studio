/** Saves a blob the page already holds as a file, without leaving the page. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadTextFile(filename: string, content: string) {
  downloadBlob(filename, new Blob([content], { type: 'text/plain' }))
}
