export const errorsCopy = {
  clipboard: {
    success: 'Copied to clipboard!',
    failure: 'Failed to copy to clipboard.',
  },
  download: {
    failure: 'Download failed. Check your connection and try again.',
  },
  importUserData: {
    success: (favorites: number, recents: number, jobs: number) =>
      `Imported ${favorites} favorites, ${recents} recent genes, ${jobs} jobs`,
    nothingNew:
      'Nothing new to import: everything in that backup is already here.',
    tooLarge: 'That file is too large to be a REJ Studio backup.',
    invalid: 'That file isn’t a REJ Studio backup.',
    failure: 'Import failed. Check the file format and try again.',
  },
} as const
