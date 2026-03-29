function sanitizeFilename(raw: string): string {
  // Strip quotes, path separators, and control characters
  return raw
    .replace(/["']/g, '')
    .replace(/[/\\:*?<>|]/g, '_')
    .trim() || 'download.zip'
}

export default async function downloadZip(response: Response) {
  const blob = await response.blob()

  const disposition = response.headers.get('Content-Disposition')
  const rawName = disposition?.split('filename=')[1] ?? 'file.fasta'
  const fileName = sanitizeFilename(rawName)

  const fileURL = URL.createObjectURL(blob)
  try {
    const fileLink = document.createElement('a')
    fileLink.href = fileURL
    fileLink.download = fileName
    fileLink.click()
  } finally {
    URL.revokeObjectURL(fileURL)
  }
}
