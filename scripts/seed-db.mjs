import Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_PATH = join(ROOT, 'public', 'data')

const db = new Database(join(ROOT, 'data.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  DROP TABLE IF EXISTS sequences;
  DROP TABLE IF EXISTS disease_associations;
  DROP TABLE IF EXISTS isoforms;
  DROP TABLE IF EXISTS genes;

  CREATE TABLE genes (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ensg TEXT NOT NULL,
    chromosome TEXT NOT NULL
  );

  CREATE TABLE isoforms (
    enst TEXT PRIMARY KEY,
    gene_symbol TEXT NOT NULL REFERENCES genes(symbol),
    length INTEGER NOT NULL,
    packagability INTEGER NOT NULL,
    species TEXT NOT NULL
  );

  CREATE TABLE disease_associations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gene_symbol TEXT NOT NULL REFERENCES genes(symbol),
    disease TEXT NOT NULL
  );

  CREATE TABLE sequences (
    enst TEXT PRIMARY KEY REFERENCES isoforms(enst),
    coding_sequence TEXT NOT NULL DEFAULT '',
    protein_sequence TEXT NOT NULL DEFAULT ''
  );

  CREATE INDEX idx_isoforms_gene ON isoforms(gene_symbol);
  CREATE INDEX idx_diseases_gene ON disease_associations(gene_symbol);
`)

const genes = JSON.parse(
  readFileSync(join(DATA_PATH, 'genes.json'), 'utf8')
)

const insertGene = db.prepare(
  'INSERT INTO genes (symbol, name, ensg, chromosome) VALUES (?, ?, ?, ?)'
)
const insertIsoform = db.prepare(
  'INSERT OR IGNORE INTO isoforms (enst, gene_symbol, length, packagability, species) VALUES (?, ?, ?, ?, ?)'
)
const insertDisease = db.prepare(
  'INSERT INTO disease_associations (gene_symbol, disease) VALUES (?, ?)'
)
const insertSequence = db.prepare(
  'INSERT OR IGNORE INTO sequences (enst, coding_sequence, protein_sequence) VALUES (?, ?, ?)'
)

function readSequenceFile(dir, enst) {
  try {
    return readFileSync(join(DATA_PATH, dir, `${enst}.txt`), 'utf8').trim()
  } catch {
    return ''
  }
}

const seed = db.transaction(() => {
  for (const gene of genes) {
    insertGene.run(gene.symbol, gene.name, gene.ENSG, gene.chromosome)

    for (const isoform of gene.isoforms) {
      insertIsoform.run(
        isoform.ENST,
        gene.symbol,
        isoform.length,
        isoform.packagability,
        isoform.species
      )

      const coding = readSequenceFile('coding_sequences', isoform.ENST)
      const protein = readSequenceFile('protein_sequences', isoform.ENST)
      insertSequence.run(isoform.ENST, coding, protein)
    }

    if (gene.diseaseAssociations) {
      for (const disease of gene.diseaseAssociations) {
        insertDisease.run(gene.symbol, disease)
      }
    }
  }
})

seed()

const geneCount = db.prepare('SELECT COUNT(*) as count FROM genes').get()
const isoformCount = db.prepare('SELECT COUNT(*) as count FROM isoforms').get()
const diseaseCount = db
  .prepare('SELECT COUNT(*) as count FROM disease_associations')
  .get()
const seqCount = db.prepare('SELECT COUNT(*) as count FROM sequences').get()
const nonEmptySeq = db
  .prepare("SELECT COUNT(*) as count FROM sequences WHERE coding_sequence != ''")
  .get()

console.log(`Seeded database:`)
console.log(`  ${geneCount.count} genes`)
console.log(`  ${isoformCount.count} isoforms`)
console.log(`  ${diseaseCount.count} disease associations`)
console.log(`  ${seqCount.count} sequences (${nonEmptySeq.count} with coding data)`)

db.close()
