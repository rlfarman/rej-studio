import { expect, test, type Page } from '@playwright/test'

/**
 * The coding-sequence field is uncontrolled: the browser owns its text while
 * typing, and writes from elsewhere are pushed into it
 * (src/features/design-tool/components/coding-sequence-input.tsx). These
 * cover both halves: no keystroke is lost, and every outside write still
 * reaches the field.
 */

const TP53_ISOFORM = '/design-tool?isoform=ENST00000269305'
const CODONS = 'ATGAAACCCGGGTTTACGTGCA'

function sequenceField(page: Page) {
  return page.getByRole('textbox', { name: /enter your sequence/i })
}

test('typing a sequence keeps every base', async ({ page }) => {
  // Each base re-renders the split-point editor, whose effects write back
  // into the form. While the field was controlled, a write landing between a
  // keystroke and its render made React restore the old text, dropping a base.
  await page.goto('/design-tool')
  const field = sequenceField(page)
  await field.click()

  const sequence = CODONS.repeat(12)
  await page.keyboard.type(sequence)

  await expect(field).toHaveValue(sequence)
})

test('a loaded isoform fills the field', async ({ page }) => {
  await page.goto(TP53_ISOFORM)
  await expect(sequenceField(page)).toHaveValue(/^ATG[ACGT]{200,}$/)
})

test('a restored draft fills the field, and discarding it empties it', async ({
  page,
}) => {
  await page.goto('/design-tool')
  const field = sequenceField(page)
  await field.click()
  await page.keyboard.type(CODONS.repeat(3))
  // The draft is saved on a debounce.
  await page.waitForTimeout(1_200)

  await page.reload()
  await expect(field).toHaveValue(CODONS.repeat(3))

  await page.getByRole('button', { name: /discard draft/i }).click()
  await expect(field).toHaveValue('')
})

test('switching to protein shows the translation, and back to DNA clears it', async ({
  page,
}) => {
  await page.goto('/design-tool')
  const field = sequenceField(page)
  await field.click()
  await page.keyboard.type('ATGGCCAAATTTTGA')

  await page.getByRole('radio', { name: /protein/i }).click()
  await expect(field).toHaveValue('MAKF')

  await page.getByRole('radio', { name: /dna/i }).click()
  await expect(field).toHaveValue('')
})

test('a pasted FASTA record is cleaned into the field', async ({ page }) => {
  await page.goto('/design-tool')
  const field = sequenceField(page)
  await field.click()
  await field.evaluate((el) => {
    const data = new DataTransfer()
    data.setData('text', '>TP53 fragment\nATG GCC AAA\nTTT TGA\n')
    el.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    )
  })
  await expect(field).toHaveValue('ATGGCCAAATTTTGA')
})
