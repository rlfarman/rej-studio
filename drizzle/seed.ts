import 'dotenv/config'
import { db } from './db'
import { genes } from './schema'
import { openai } from '../app/_lib/openai'
import genesData from './genes.json'
import { embed } from 'ai'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('process.env.OPENAI_API_KEY is not defined. Please set it.')
}

if (!process.env.POSTGRES_URL) {
  throw new Error('process.env.POSTGRES_URL is not defined. Please set it.')
}

async function main() {
  try {
    const gene = await db.query.genes.findFirst({
      where: (genes, { eq }) => eq(genes.name, 'Riken cdna 1110002e22 gene'),
    })
    if (gene) {
      console.log('Genes already seeded!')
      return
    }
  } catch (error) {
    console.error('Error checking if gene exists in the database.')
    throw error
  }
  for (const record of genesData as any) {
    await new Promise((r) => setTimeout(r, 500)) // Wait 500ms between requests

    // Create the gene in the database
    const [gene] = await db.insert(genes).values(record).returning()

    console.log(`Added ${record.symbol} ${record.name}`)
  }
}
main()
  .then(async () => {
    process.exit(0)
  })
  .catch(async (e) => {
    console.error(e)

    process.exit(1)
  })

async function generateEmbedding(_input: string) {
  const input = _input.replace(/\n/g, ' ')
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: input,
  })
  return embedding
}
