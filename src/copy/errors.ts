export const errorsCopy = {
  clipboard: {
    success: 'Copied to clipboard!',
    failure: 'Failed to copy to clipboard.',
  },
  download: {
    failure: 'Download failed. Check your connection and try again.',
  },
  importUserData: {
    success: (imported: number) =>
      `Imported ${imported} ${imported === 1 ? 'category' : 'categories'}`,
    failure: 'Import failed. Check the file format and try again.',
  },
} as const
