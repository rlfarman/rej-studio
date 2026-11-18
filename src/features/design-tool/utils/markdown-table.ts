/**
 * Make text safe for one cell of a GitHub-flavored Markdown table.
 *
 * Backslashes are escaped first: escaping only `|` turns an input `\|` into
 * `\\|`, where the doubled backslash cancels the escape and the pipe splits
 * the row. Line breaks would end the row, so they become spaces.
 */
export function escapeMarkdownTableCell(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
}
