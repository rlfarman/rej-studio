export const errorsCopy = {
  clipboard: {
    success: 'Copied to clipboard!',
    failure: 'Failed to copy to clipboard.',
  },
  download: {
    failure: 'Download failed.',
  },
  importUserData: {
    success: (imported: number) =>
      `Imported ${imported} data ${imported === 1 ? 'category' : 'categories'}`,
    failure: 'Import failed',
  },
} as const
