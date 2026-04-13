import { test, expect } from '@playwright/test'

test.describe('gene search → customize flow', () => {
  test('searches ATM, opens the gene page, and customizes an isoform', async ({
    page,
  }) => {
    await page.goto('/')

    const search = page.getByRole('combobox', { name: /search genes/i })
    await expect(search).toBeVisible()
    await search.fill('ATM')

    const atmOption = page
      .getByRole('option', { name: /^ATM Ataxia Telangiectasia Mutated/i })
      .first()
    await expect(atmOption).toBeVisible({ timeout: 10_000 })
    // cmdk options don't always fire onSelect on a plain click in Playwright —
    // the first option is auto-selected, so Enter on the input works reliably.
    await search.press('Enter')

    await expect(page).toHaveURL(/\/genes\/ATM/)
    await expect(
      page.getByRole('heading', { name: 'ATM', level: 1 }),
    ).toBeVisible()

    const customizeLink = page
      .getByRole('link', { name: /customize ENS/i })
      .first()
    await expect(customizeLink).toBeVisible({ timeout: 10_000 })
    await customizeLink.click()

    await expect(page).toHaveURL(/\/design-tool\?isoform=ENS\w+/)
    await expect(
      page.getByRole('heading', { name: 'REJ Studio Design Tool' }),
    ).toBeVisible()

    const nameField = page.getByRole('textbox', {
      name: /choose a name for your coding sequence/i,
    })
    await expect(nameField).toHaveValue(/^Custom ATM/)

    const sequenceField = page.getByPlaceholder(/^ATGATTACA/)
    const sequenceValue = await sequenceField.inputValue()
    expect(sequenceValue.length).toBeGreaterThan(0)
    expect(sequenceValue).toMatch(/^[ACGTUacgtu]+$/)
  })
})
