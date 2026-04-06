-- Populate the search_vector column on genes table.
-- Run after db:push + db:upload, or as part of the seed process.
--
-- Weights: A = symbol (exact match priority), B = name, C = alternate symbols.
-- The 'simple' config avoids stemming since gene symbols are proper nouns.

UPDATE genes
SET search_vector =
  setweight(to_tsvector('simple', coalesce(symbol, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(name, '')), 'B') ||
  setweight(to_tsvector('simple', replace(coalesce(alternate_symbols, ''), '|', ' ')), 'C');
