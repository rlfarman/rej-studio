import Database from 'better-sqlite3'
import { readFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'

const TEST_DB_PATH = path.join(process.cwd(), 'data.test.db')

export function setup() {
  const db = new Database(TEST_DB_PATH)
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
    readFileSync(path.join(process.cwd(), 'public', 'data', 'genes.json'), 'utf8')
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
        insertSequence.run(isoform.ENST, '', '')
      }
      if (gene.diseaseAssociations) {
        for (const disease of gene.diseaseAssociations) {
          insertDisease.run(gene.symbol, disease)
        }
      }
    }
  })

  seed()
  db.close()
}

export function teardown() {
  try { unlinkSync(TEST_DB_PATH) } catch {}
  try { unlinkSync(TEST_DB_PATH + '-wal') } catch {}
  try { unlinkSync(TEST_DB_PATH + '-shm') } catch {}
}
