export default async function downloadZip(response: Response) {
  const blob = await response.blob()
  const fileName =
    response.headers.get('Content-Disposition')?.split('filename=')[1] ??
    'file.fasta'
  const fileURL = URL.createObjectURL(blob)
  const fileLink = document.createElement('a')
  fileLink.href = fileURL
  fileLink.download = fileName
  fileLink.click()
}
