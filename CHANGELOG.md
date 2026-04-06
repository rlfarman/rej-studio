# Changelog

## [0.2.1](https://github.com/rlfarman/rej-studio/compare/v0.2.0...v0.2.1) (2026-04-06)


### Features

* add custom hooks for managing favorite and recent genes, gene search with species context, and species selection from local storage or query parameters ([c75a954](https://github.com/rlfarman/rej-studio/commit/c75a954ecc1a3808e3706b634b92193446708eba))
* add dev-only seed data button ([#79](https://github.com/rlfarman/rej-studio/issues/79)) ([b955d90](https://github.com/rlfarman/rej-studio/commit/b955d9031831e4e2c09ee57046bd334f8b7b23f8))
* add env-driven site maintenance banner ([#90](https://github.com/rlfarman/rej-studio/issues/90)) ([60385b2](https://github.com/rlfarman/rej-studio/commit/60385b2d29c197c6ec40192e02f1071ae8caa650))
* **analytics:** add typed event tracking, consent mode v2, and SPA pageview support ([#120](https://github.com/rlfarman/rej-studio/issues/120)) ([d95abb7](https://github.com/rlfarman/rej-studio/commit/d95abb7a2a9f5f505854dac8a49084ec1f6d92be))
* **analytics:** switch to Google Tag Manager via @next/third-parties ([#119](https://github.com/rlfarman/rej-studio/issues/119)) ([902798e](https://github.com/rlfarman/rej-studio/commit/902798e7d6def0824a5092ead296f4a691bde58a))
* CI hardening, server resilience, and DX tooling overhaul ([#118](https://github.com/rlfarman/rej-studio/issues/118)) ([cc2c0a1](https://github.com/rlfarman/rej-studio/commit/cc2c0a1214187c460ece410872f0b65acee3adfb))
* condense design tool UI after job submission ([#81](https://github.com/rlfarman/rej-studio/issues/81)) ([1835acd](https://github.com/rlfarman/rej-studio/commit/1835acd30ed3e15f04ef0df1807711ed0545c85f))
* **design-tool:** add icons to results dropdowns and remove duplicated titles ([#108](https://github.com/rlfarman/rej-studio/issues/108)) ([31d27db](https://github.com/rlfarman/rej-studio/commit/31d27dbd83a227653ea0c6421c96bb0a8388b631))
* **design-tool:** expand result sections by default ([#107](https://github.com/rlfarman/rej-studio/issues/107)) ([d74d490](https://github.com/rlfarman/rej-studio/commit/d74d490a56e0c7779621f6f4c22a4ee226b93a2f))
* **design-tool:** refine codon optimization and stimulatory intron UI ([#89](https://github.com/rlfarman/rej-studio/issues/89)) ([e424e56](https://github.com/rlfarman/rej-studio/commit/e424e56b2494b7107ebf9c4ea43e8d4a019b1374))
* **design-tool:** show AAV packaging zones on splice slider ([#99](https://github.com/rlfarman/rej-studio/issues/99)) ([e84b448](https://github.com/rlfarman/rej-studio/commit/e84b4488ba2c611395346211f97a9737223308fc))
* **design-tool:** structured before/after objectives report ([#82](https://github.com/rlfarman/rej-studio/issues/82)) ([e02d276](https://github.com/rlfarman/rej-studio/commit/e02d2766b4351450ffbbb824216912ecdcbf7aa6))
* **design-tool:** surface splice, CAI, and kmer metrics in results ([#98](https://github.com/rlfarman/rej-studio/issues/98)) ([ca4825a](https://github.com/rlfarman/rej-studio/commit/ca4825a5fe4cd379d3ee63213d1c626465e7f977))
* **design-tool:** tier-based weight controls ([#86](https://github.com/rlfarman/rej-studio/issues/86)) ([4ae80cb](https://github.com/rlfarman/rej-studio/commit/4ae80cb78624abbb0d703059e1317a5f75e30bee))
* drop Python from Vercel, require Modal in production ([#106](https://github.com/rlfarman/rej-studio/issues/106)) ([5508cec](https://github.com/rlfarman/rej-studio/commit/5508cec125a3d633910dbbdef608cd4b81b573fd))
* expand design-tool and gene-page visualizations ([#77](https://github.com/rlfarman/rej-studio/issues/77)) ([809265b](https://github.com/rlfarman/rej-studio/commit/809265bd34865e724090041b3c5b546e064531a8))
* **gene-page:** link isoform visualization rows to table ([#88](https://github.com/rlfarman/rej-studio/issues/88)) ([56935b4](https://github.com/rlfarman/rej-studio/commit/56935b44d282375c5bcf4e983b3f15dc4c18fa91))
* **gene-search:** enrich isoform expanded view with design metrics and REJ split preview ([#104](https://github.com/rlfarman/rej-studio/issues/104)) ([98d0efd](https://github.com/rlfarman/rej-studio/commit/98d0efd7775f25970b20032f75c863c28d2f9250))
* **gene-search:** surface isoform table above visualizations ([#112](https://github.com/rlfarman/rej-studio/issues/112)) ([f4acbbc](https://github.com/rlfarman/rej-studio/commit/f4acbbc64c05537eac45e380f524391bc66b9f4a))
* harden jobs system with structured errors, cancel, and cross-tab sync ([#73](https://github.com/rlfarman/rej-studio/issues/73)) ([2623824](https://github.com/rlfarman/rej-studio/commit/26238243a75fce2e7b80e05fb0257ac21ffcd14f))
* migrate database from SQLite/git-lfs to Turso ([#83](https://github.com/rlfarman/rej-studio/issues/83)) ([e0a6977](https://github.com/rlfarman/rej-studio/commit/e0a69771c60ed02476fb658a2bebeb8815925743))
* migrate database from Turso to Neon Postgres ([#97](https://github.com/rlfarman/rej-studio/issues/97)) ([067b562](https://github.com/rlfarman/rej-studio/commit/067b562526eb59685868f42e94b8a5c3a4023d69))
* remove recommended isoform suggestion ([f4b4fe8](https://github.com/rlfarman/rej-studio/commit/f4b4fe82dbf599cafc7c83c035095a91c7f557ac))
* replace theme toggle button with light/dark/system select ([#75](https://github.com/rlfarman/rej-studio/issues/75)) ([c528eaf](https://github.com/rlfarman/rej-studio/commit/c528eaff8f35ea18ed180d90c4bca4a0f09c15b4))
* **search:** add Customize button to gene search results ([#84](https://github.com/rlfarman/rej-studio/issues/84)) ([2e5e09f](https://github.com/rlfarman/rej-studio/commit/2e5e09f7bf73ba5284e0509134f4bf57094b053b))
* **search:** search isoforms by ENST/ENSMUST ID with gene page highlight ([#76](https://github.com/rlfarman/rej-studio/issues/76)) ([8d0030a](https://github.com/rlfarman/rej-studio/commit/8d0030a96243c888fbde413afb80bab7dc7858f9))
* **seed:** use real CDS, realistic demo data, and seed isolation ([#105](https://github.com/rlfarman/rej-studio/issues/105)) ([5d8eeb4](https://github.com/rlfarman/rej-studio/commit/5d8eeb4f6d6aabd685df411c1563577c008be411))
* show Seed data menu item in all environments ([#91](https://github.com/rlfarman/rej-studio/issues/91)) ([cb97bc7](https://github.com/rlfarman/rej-studio/commit/cb97bc761242571acf535f12f9b3713e890c443f))
* support dual Vercel/Cloudflare deployment ([#100](https://github.com/rlfarman/rej-studio/issues/100)) ([015a70d](https://github.com/rlfarman/rej-studio/commit/015a70d0872cfbbc6bbad6ab5ec6cc328687d45b))
* wire up basic auth middleware for landing page ([#92](https://github.com/rlfarman/rej-studio/issues/92)) ([3774959](https://github.com/rlfarman/rej-studio/commit/377495986afe5e31600cfdf17f74e8baa99a13cf))


### Bug Fixes

* add missing @radix-ui/react-dropdown-menu dependency ([#78](https://github.com/rlfarman/rej-studio/issues/78)) ([030cd33](https://github.com/rlfarman/rej-studio/commit/030cd33c9a815c1ed7fb0fe0b6d128137bf8a1da))
* **ci:** fix pnpm audit cache and SBOM OOM in security workflow ([#122](https://github.com/rlfarman/rej-studio/issues/122)) ([64a0d24](https://github.com/rlfarman/rej-studio/commit/64a0d24c744e57cdc59cee525f1921e0fdf52183))
* **ci:** use pnpm-compatible SBOM generator and opt release-please into Node 24 ([#123](https://github.com/rlfarman/rej-studio/issues/123)) ([c539fe8](https://github.com/rlfarman/rej-studio/commit/c539fe85affe2a8013adc99618ee6945fd8c2386))
* **db:** switch Turso to direct HTTP mode ([#87](https://github.com/rlfarman/rej-studio/issues/87)) ([f81f825](https://github.com/rlfarman/rej-studio/commit/f81f825750ff0567c2f87183107c6c8c511416b8))
* **design-tool:** restore live job progress during DNAChisel runs ([#109](https://github.com/rlfarman/rej-studio/issues/109)) ([1b4ea02](https://github.com/rlfarman/rej-studio/commit/1b4ea02e75d2374fd38b3ebcdfd7d6f3c11647de))
* **design-tool:** tighten sequence input diagnostics layout ([#93](https://github.com/rlfarman/rej-studio/issues/93)) ([10eaf21](https://github.com/rlfarman/rej-studio/commit/10eaf215b81a3ef3c77857f7566d70a9e96f4cb5))
* **design-tool:** use first sequence when multi-entry FASTA is provided ([#111](https://github.com/rlfarman/rej-studio/issues/111)) ([25fff3b](https://github.com/rlfarman/rej-studio/commit/25fff3b3857933e1543f27afed1b0bb6950c00ab))
* make preview launch.json work in concurrent worktrees ([#95](https://github.com/rlfarman/rej-studio/issues/95)) ([e6b1252](https://github.com/rlfarman/rej-studio/commit/e6b12523885e3b17befae61128476240ee8cf26f))


### Refactors

* **design-tool:** remove preset optimization strategies ([#85](https://github.com/rlfarman/rej-studio/issues/85)) ([58e6a7a](https://github.com/rlfarman/rej-studio/commit/58e6a7a28e196c4fb47de40d4a2eeab66b3e61dc))
* **middleware:** use timing-safe credential comparison ([#94](https://github.com/rlfarman/rej-studio/issues/94)) ([58fd39b](https://github.com/rlfarman/rej-studio/commit/58fd39b083a12da5993d03c72ac3cde5a95e9498))
* reorganize codebase with src/ directory and feature-based structure ([#71](https://github.com/rlfarman/rej-studio/issues/71)) ([3545eaf](https://github.com/rlfarman/rej-studio/commit/3545eaf8fd881cf5c9f45bd716e76ef2164db53a))
