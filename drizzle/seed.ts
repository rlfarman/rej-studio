import 'dotenv/config'
import { db } from './db'
import { genes } from './schema'
import { eq } from 'drizzle-orm'
import { openai } from '../app/_lib/openai'
import genesData from './genes.json'
import { embed } from 'ai'
import * as fs from 'fs'
import * as path from 'path'

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
    // In order to save time, we'll just use the embeddings we've already generated
    // for each Pokémon. If you want to generate them yourself, uncomment the
    // following line and comment out the line after it.
    // const embedding = await generateEmbedding(
    //   `${record.name} ${record.symbol} ${record.ENSG} ${
    //     record.chromosome
    //   } ${record.diseaseAssociations?.join(' ')}      `
    // )
    // update record with the embedding
    // record.embedding = embedding
    await new Promise((r) => setTimeout(r, 500)) // Wait 500ms between requests;

    // Create the pokemon in the database
    const [gene] = await db.insert(genes).values(record).returning()

    // await db
    //   .update(genes)
    //   .set({
    //     embedding,
    //   })
    //   .where(eq(genes.ENSG, record.ENSG))

    console.log(`Added ${record.number} ${record.name}`)
  }

  // Uncomment the following lines if you want to generate the JSON file
  // fs.writeFileSync(
  //   path.join(__dirname, './genes-with-embeddings.json'),
  //   JSON.stringify({ data: genes }, null, 2)
  // )
  // console.log('Pokédex seeded successfully!')
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
