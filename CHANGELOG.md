# Changelog

## [0.2.3](https://github.com/rlfarman/rej-studio/compare/v0.2.2...v0.2.3) (2026-11-16)


### Features

* **auth:** overhaul login screen with DNA helix background ([#226](https://github.com/rlfarman/rej-studio/issues/226)) ([f68ed74](https://github.com/rlfarman/rej-studio/commit/f68ed740ed56a5f66516d837624a378322445014))
* **auth:** session-cookie gate so crawlers see OG metadata ([#204](https://github.com/rlfarman/rej-studio/issues/204)) ([3f1585c](https://github.com/rlfarman/rej-studio/commit/3f1585cd51eb6a744c9a31a1818393a9550c0e72))
* **design-tool:** stack result sequences, highlight introns, promote download ([#209](https://github.com/rlfarman/rej-studio/issues/209)) ([c386a6d](https://github.com/rlfarman/rej-studio/commit/c386a6dcbc7c2fff0c9de2add003c89c297392cd))
* **dev:** zero-setup local dev with sample seed + db:fetch ([#247](https://github.com/rlfarman/rej-studio/issues/247)) ([a1b53b1](https://github.com/rlfarman/rej-studio/commit/a1b53b18a218e4b1b2aade1df5d013aa286e1551))
* **disease-landscape:** add explorer for large-CDS disease genes ([#198](https://github.com/rlfarman/rej-studio/issues/198)) ([5f3dcb4](https://github.com/rlfarman/rej-studio/commit/5f3dcb41dc1832e8f9d5471e836f79fd42d81a43))
* **disease-landscape:** add largest CDS column ([#207](https://github.com/rlfarman/rej-studio/issues/207)) ([c008e2e](https://github.com/rlfarman/rej-studio/commit/c008e2e6e779c0956663d4f1ecb23aa3812fd795))
* **gene-search:** add text labels to isoform action buttons ([#222](https://github.com/rlfarman/rej-studio/issues/222)) ([f4ce9aa](https://github.com/rlfarman/rej-studio/commit/f4ce9aa91cfcd1b028c35e132560c8f1beccbc8f))
* **gene-search:** enable precomputed ZIP download for isoforms ([#231](https://github.com/rlfarman/rej-studio/issues/231)) ([6645a5a](https://github.com/rlfarman/rej-studio/commit/6645a5a2f035995958117ff6cffb9c4754334e5e))
* **gene-search:** in-place loader during gene navigation ([#248](https://github.com/rlfarman/rej-studio/issues/248)) ([390112d](https://github.com/rlfarman/rej-studio/commit/390112d39678bce41e35c299fb5f56c15d59649d))
* **layout:** adaptive header and inline footer ([#187](https://github.com/rlfarman/rej-studio/issues/187)) ([5813964](https://github.com/rlfarman/rej-studio/commit/581396493e74d8947c5334c63aa5b5ed3d6fb6a6))
* **og:** refresh OG images for helix theme and serif display font ([#179](https://github.com/rlfarman/rej-studio/issues/179)) ([5a85fe3](https://github.com/rlfarman/rej-studio/commit/5a85fe3b9aafddfa4306d44e0b8fc079a417e2b6))
* refine design tool copy and layout ([#238](https://github.com/rlfarman/rej-studio/issues/238)) ([b75b069](https://github.com/rlfarman/rej-studio/commit/b75b0692340ae1cdab4e18f56d1bd189de9e27bd))
* refine disease associations page ([#239](https://github.com/rlfarman/rej-studio/issues/239)) ([733edff](https://github.com/rlfarman/rej-studio/commit/733edff120b938fbbc1c9e4064f42e5566749f25))
* **search:** merge favorites, recents, and jobs into Cmd+K palette ([#195](https://github.com/rlfarman/rej-studio/issues/195)) ([e54c1eb](https://github.com/rlfarman/rej-studio/commit/e54c1eb8ed009f0b1e655c579d20eb76d2cd129f))
* **sidebar:** pin nav, collapse sections with counts ([#218](https://github.com/rlfarman/rej-studio/issues/218)) ([2856dff](https://github.com/rlfarman/rej-studio/commit/2856dff968038b48532b5298c731ae34d0237138))
* **sidebar:** two-line rows replace truncation tooltips ([#185](https://github.com/rlfarman/rej-studio/issues/185)) ([0226b23](https://github.com/rlfarman/rej-studio/commit/0226b23400520eeca5ffe952bf73716e27c27fe9))
* **storybook:** add Storybook 10 with stories for UI and Bio components ([#172](https://github.com/rlfarman/rej-studio/issues/172)) ([fa608ae](https://github.com/rlfarman/rej-studio/commit/fa608aee51b026d48108f1039c4f1f2bb43a0ad7))
* streamline inducible WGGW splice selection ([#117](https://github.com/rlfarman/rej-studio/issues/117)) ([820f595](https://github.com/rlfarman/rej-studio/commit/820f595a14dfacab3040baeca6ec26b6cace6366))
* **theme:** apply helix palette and serif display font ([#176](https://github.com/rlfarman/rej-studio/issues/176)) ([03ca924](https://github.com/rlfarman/rej-studio/commit/03ca924150ea142b8a9efa13657671947ff98ae4))
* **typography:** unify type system with semantic roles ([#199](https://github.com/rlfarman/rej-studio/issues/199)) ([5e33db3](https://github.com/rlfarman/rej-studio/commit/5e33db30967c700bf1b3c575729510fbe9dca4bd))
* **ui:** add dna helix loader and smoother gene-search transitions ([#181](https://github.com/rlfarman/rej-studio/issues/181)) ([3befd47](https://github.com/rlfarman/rej-studio/commit/3befd473227b68f27dccc950d27cb96365ee67d0))
* **ui:** polish motion across job progress, results, and search ([#235](https://github.com/rlfarman/rej-studio/issues/235)) ([350b69c](https://github.com/rlfarman/rej-studio/commit/350b69ceb219c1981033a892f60050694d5c9337))
* **ui:** prominent home CTA, auto-convert DNA/protein, inline weights ([#210](https://github.com/rlfarman/rej-studio/issues/210)) ([48224cf](https://github.com/rlfarman/rej-studio/commit/48224cf336cae7ed19523e93a410c568554bcd77))
* **ui:** subtle delight pass — completion bloom, breath, console egg ([#200](https://github.com/rlfarman/rej-studio/issues/200)) ([fdf52c3](https://github.com/rlfarman/rej-studio/commit/fdf52c3ab2c7d0cccda82d98f7ca09f190c70a4a))


### Bug Fixes

* **a11y,perf:** resolve axe violations and polish across app ([#167](https://github.com/rlfarman/rej-studio/issues/167)) ([47fc49e](https://github.com/rlfarman/rej-studio/commit/47fc49e223d31afe6849546780d8a32a0c599780))
* **a11y,ui:** finish audit fixes and home polish ([#170](https://github.com/rlfarman/rej-studio/issues/170)) ([020ff17](https://github.com/rlfarman/rej-studio/commit/020ff176758629f7b997ee10f1d411c9d6926e92))
* **auth:** enforce the session gate in the proxy ([#255](https://github.com/rlfarman/rej-studio/issues/255)) ([cdcab6d](https://github.com/rlfarman/rej-studio/commit/cdcab6d8d90b34c1b380e116aae0f9d9626cfec2))
* **auth:** protect all routes with basic auth ([#162](https://github.com/rlfarman/rej-studio/issues/162)) ([b009438](https://github.com/rlfarman/rej-studio/commit/b00943819a5fa1500a9d5e4c02dc23b1e68b40ed))
* **ci:** make PR checks pass now that CI is back on ([#268](https://github.com/rlfarman/rej-studio/issues/268)) ([7d1f2ae](https://github.com/rlfarman/rej-studio/commit/7d1f2ae77f24f8ea17b594d9d0b0545deae2b175))
* **db:** stop routine traffic from waking Neon ([#257](https://github.com/rlfarman/rej-studio/issues/257)) ([bb785d1](https://github.com/rlfarman/rej-studio/commit/bb785d199761233a8964aadf4a482af52ce0321f))
* **deps:** patch protobufjs and python-multipart CVEs ([#197](https://github.com/rlfarman/rej-studio/issues/197)) ([3d55b3d](https://github.com/rlfarman/rej-studio/commit/3d55b3d67ea921ca779767ab9181072b021b6e54))
* **deps:** upgrade Next.js, Sentry and vulnerable dependencies ([#256](https://github.com/rlfarman/rej-studio/issues/256)) ([856c231](https://github.com/rlfarman/rej-studio/commit/856c231c8d3f7234ec8b77d54d9a3f6121e8e048))
* **design-tool:** align optimized sequence results and junction coordinates ([#251](https://github.com/rlfarman/rej-studio/issues/251)) ([0869ee7](https://github.com/rlfarman/rej-studio/commit/0869ee77cad17b223f5da126ed70df778690d312))
* **design-tool:** polish progress copy and unify stage labels ([#227](https://github.com/rlfarman/rej-studio/issues/227)) ([d5ac808](https://github.com/rlfarman/rej-studio/commit/d5ac808dd661393e03db413945af23738dddad18))
* **design-tool:** smoother, more responsive progress reporting ([#221](https://github.com/rlfarman/rej-studio/issues/221)) ([93e6de2](https://github.com/rlfarman/rej-studio/commit/93e6de258e17f679a85d906f9070a75141f95d10))
* **design-tool:** stop codon strip forcing horizontal overflow ([#217](https://github.com/rlfarman/rej-studio/issues/217)) ([7fafee7](https://github.com/rlfarman/rej-studio/commit/7fafee70aa5ece93fcbab62cc5e11659b8615cf5))
* **dev:** install node_modules in worktrees instead of symlinking ([#246](https://github.com/rlfarman/rej-studio/issues/246)) ([3ebf50f](https://github.com/rlfarman/rej-studio/commit/3ebf50f5954d69a7aadb5e2adb9740798123e956))
* **docs:** prevent sidebar width from squishing content on mobile ([#164](https://github.com/rlfarman/rej-studio/issues/164)) ([bf768d1](https://github.com/rlfarman/rej-studio/commit/bf768d1c3b5e5a472fcf7908b14df80c29178708))
* drop hidden docs from the sitemap and allow any local dev port ([#272](https://github.com/rlfarman/rej-studio/issues/272)) ([d86399d](https://github.com/rlfarman/rej-studio/commit/d86399dfadc25a6b7745cc1542b5680c5468e650))
* **gene-search:** resolve set-state-in-effect warning in useDelayedTrue ([#203](https://github.com/rlfarman/rej-studio/issues/203)) ([ccb81c0](https://github.com/rlfarman/rej-studio/commit/ccb81c05bc685beaa964eb9a9cfa50d8acc0c6ae))
* **gene-search:** stabilize command list item width ([#180](https://github.com/rlfarman/rej-studio/issues/180)) ([b4a02fb](https://github.com/rlfarman/rej-studio/commit/b4a02fbd888e58bc9be80d91eaff0026fffe83ce))
* **header:** readable text on command bar hover ([#214](https://github.com/rlfarman/rej-studio/issues/214)) ([1d75e5e](https://github.com/rlfarman/rej-studio/commit/1d75e5e4a0bde6faea10e63fcf02818f5934ad3c))
* **home:** center page content vertically instead of fixed top offset ([#219](https://github.com/rlfarman/rej-studio/issues/219)) ([88b9c7d](https://github.com/rlfarman/rej-studio/commit/88b9c7d7c2cd926b00ffea04eb159fbfe6eaacdb))
* **home:** prevent mobile overflow clip, polish desktop spacing ([#183](https://github.com/rlfarman/rej-studio/issues/183)) ([fccb13b](https://github.com/rlfarman/rej-studio/commit/fccb13bb37cf213cb848543073343f464270949a))
* **mobile:** resolve 375px overflow ([#168](https://github.com/rlfarman/rej-studio/issues/168)) ([23b6575](https://github.com/rlfarman/rej-studio/commit/23b65752ac1adbb00ba8c4c0de3157a432c6d6e8))
* **mobile:** responsive layout improvements across the app ([#166](https://github.com/rlfarman/rej-studio/issues/166)) ([cecafdd](https://github.com/rlfarman/rej-studio/commit/cecafddc2d51e545714151785c07cf4b3e5ea833))
* **proxy:** exempt /api/og/* from basic-auth middleware ([#196](https://github.com/rlfarman/rej-studio/issues/196)) ([b3d258d](https://github.com/rlfarman/rej-studio/commit/b3d258dfb9ed711edd1de49c92cd93ed0ab3026a))
* **settings-menu:** boost icon contrast ([#233](https://github.com/rlfarman/rej-studio/issues/233)) ([24a7245](https://github.com/rlfarman/rej-studio/commit/24a7245226c42093195e92caaf4c584e449f7797))
* **sidebar:** prevent horizontal scroll from clear button ([#230](https://github.com/rlfarman/rej-studio/issues/230)) ([58b14da](https://github.com/rlfarman/rej-studio/commit/58b14da89ff4d16260689c7e7cf1aae454a575ce))
* **sidebar:** remove unbuilt Batch link that 404s ([#163](https://github.com/rlfarman/rej-studio/issues/163)) ([a7cd7dc](https://github.com/rlfarman/rej-studio/commit/a7cd7dcc07586a797cb5e917ffebbbd0f6e880f6))
* **ui:** darken muted text on hovered accent rows ([#178](https://github.com/rlfarman/rej-studio/issues/178)) ([e417e12](https://github.com/rlfarman/rej-studio/commit/e417e12621678bccb42681a61dff7bd192fe9092))
* **ui:** layout audit — spacing, rhythm, and sidebar density ([#175](https://github.com/rlfarman/rej-studio/issues/175)) ([478e288](https://github.com/rlfarman/rej-studio/commit/478e2881fdf08533c51062caa01ed62492840722))
* **ui:** patch responsive breakpoint gaps ([#234](https://github.com/rlfarman/rej-studio/issues/234)) ([aba94db](https://github.com/rlfarman/rej-studio/commit/aba94db065ef9a45134df70a98dabe655fe84d1c))
* **ui:** restore sidebar X button visibility on hover ([#184](https://github.com/rlfarman/rej-studio/issues/184)) ([589c56e](https://github.com/rlfarman/rej-studio/commit/589c56e6a04b24154e96b70193e83d20f5731b02))


### Performance

* static (app) layout, faster isoform sort, cached queries ([#205](https://github.com/rlfarman/rej-studio/issues/205)) ([9e7554c](https://github.com/rlfarman/rej-studio/commit/9e7554c98fa86ee4d304b2576ea83d0e11fe3777))


### Documentation

* **agents:** align AGENTS.md with current project state ([#186](https://github.com/rlfarman/rej-studio/issues/186)) ([e9920f0](https://github.com/rlfarman/rej-studio/commit/e9920f0b520e9e8cd35364dc45ce3be76fb799e1))
* **copy:** tighten scientific accuracy across UI and docs ([#194](https://github.com/rlfarman/rej-studio/issues/194)) ([e8b8ce5](https://github.com/rlfarman/rej-studio/commit/e8b8ce51936554c2784eead60ac55597ada90bbb))


### Refactors

* **color:** categorical AAV palette, semantic tokens aligned to theme ([#216](https://github.com/rlfarman/rej-studio/issues/216)) ([3bff172](https://github.com/rlfarman/rej-studio/commit/3bff172215a1a5a30efb8d2b7f2ad20112fbb9e6))
* **copy:** centralize user-facing strings per feature ([#177](https://github.com/rlfarman/rej-studio/issues/177)) ([9b00c85](https://github.com/rlfarman/rej-studio/commit/9b00c85a4f32de837d6165e5d25cd761dff7ae5a))
* **copy:** clarity pass — consistent case, actionable errors, dedup ([#182](https://github.com/rlfarman/rej-studio/issues/182)) ([5eef490](https://github.com/rlfarman/rej-studio/commit/5eef490a8917995092030a2b3517a0cf637a5660))
* **design-tool:** consolidate sequence export into dropdown ([#174](https://github.com/rlfarman/rej-studio/issues/174)) ([9fbbd96](https://github.com/rlfarman/rej-studio/commit/9fbbd96a0356e31a45bd8d8b9f125a2ece7d846b))
* **design-tool:** remove GC sparkline and codon usage heatmap from input ([#228](https://github.com/rlfarman/rej-studio/issues/228)) ([eb070ec](https://github.com/rlfarman/rej-studio/commit/eb070ecb45a56c8ef2e2b84810a983228d7b38db))
* extract ExpandableSidebarList, MetricCell, and CopyButton ([#171](https://github.com/rlfarman/rej-studio/issues/171)) ([6a3f188](https://github.com/rlfarman/rej-studio/commit/6a3f1886bcf838b6066a71e618c0b608da19b5bf))
* **gene-page:** quieter AAV fit strip + cleaner disease associations ([#211](https://github.com/rlfarman/rej-studio/issues/211)) ([f9afc71](https://github.com/rlfarman/rej-studio/commit/f9afc71588fda4b0ff3cfcbf4df19daa9c112254))
* **onboarding:** replace custom tour with driver.js ([#165](https://github.com/rlfarman/rej-studio/issues/165)) ([f12256d](https://github.com/rlfarman/rej-studio/commit/f12256d119ea79e3b30b40cc8b454dfa7b0d395d))
* rename disease-landscape to disease-associations ([#208](https://github.com/rlfarman/rej-studio/issues/208)) ([c485c4e](https://github.com/rlfarman/rej-studio/commit/c485c4e38e5272355829cabb9826c64c6d5678ef))
* **ui:** centralize status colors and normalize tokens ([#201](https://github.com/rlfarman/rej-studio/issues/201)) ([9aa9173](https://github.com/rlfarman/rej-studio/commit/9aa9173e1cf8b486dc70fca56a9ea0ea8478825e))
* **ui:** normalize design tokens and typography utilities ([#236](https://github.com/rlfarman/rej-studio/issues/236)) ([a14927f](https://github.com/rlfarman/rej-studio/commit/a14927ff64d4cdf23e758f391b0d78eb4c4b481d))

## [0.2.2](https://github.com/rlfarman/rej-studio/compare/v0.2.1...v0.2.2) (2026-04-12)


### Features

* **design-tool:** rearrange results panel and show sequences side-by-side ([#129](https://github.com/rlfarman/rej-studio/issues/129)) ([057b915](https://github.com/rlfarman/rej-studio/commit/057b915d5215e2d821c900f4a68713cd4d82a115))
* **docker:** add dev and production Docker setup ([#128](https://github.com/rlfarman/rej-studio/issues/128)) ([3f092e5](https://github.com/rlfarman/rej-studio/commit/3f092e59ac005cd25819b4486bd8e99511706934))
* **observability:** add full OTEL instrumentation with Axiom ([#133](https://github.com/rlfarman/rej-studio/issues/133)) ([20908f0](https://github.com/rlfarman/rej-studio/commit/20908f09135de3c7775ba175c84da2c9179c84c8))
* **observability:** add Sentry error monitoring integration ([#131](https://github.com/rlfarman/rej-studio/issues/131)) ([516e34f](https://github.com/rlfarman/rej-studio/commit/516e34fbaaddc985d3783a0651064b62c0b4fe41))
* **ui:** add drag-to-resize sidebar ([#127](https://github.com/rlfarman/rej-studio/issues/127)) ([4f55eb2](https://github.com/rlfarman/rej-studio/commit/4f55eb2df6f4ec74f758e678210f2ab12681336f))


### Bug Fixes

* **ci:** ignore auto-generated CHANGELOG.md in Prettier ([#125](https://github.com/rlfarman/rej-studio/issues/125)) ([8b5fa0a](https://github.com/rlfarman/rej-studio/commit/8b5fa0afea00d05370edf4540618dbce34b35fb5))
* **deps:** bump next to 16.2.3 and vite to 8.0.8 for security advisories ([46108a7](https://github.com/rlfarman/rej-studio/commit/46108a71e485c255ea585f9de00644db24b99092))
* **observability:** remove root instrumentation files shadowing OTEL setup ([241d02b](https://github.com/rlfarman/rej-studio/commit/241d02b7e49bdf41292394ce84c212cb743915b0))
* **observability:** tune OTEL for Vercel serverless traces ([d6b829d](https://github.com/rlfarman/rej-studio/commit/d6b829dc97e698377b8f4fa7c2b45285dd6f768d))

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
