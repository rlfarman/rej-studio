# Modernize RNA End-Joining Design Tool

## Context
This Next.js 13.4 app (from ~mid-2023) needs modernization. Dependencies are 3 years out of date, there are several bugs, security issues, and code quality problems. The goal is to bring everything up to current standards.

## Bugs to Fix

1. **Double `await` in `Promise.all`** (`app/(search)/genes/[symbol]/page.tsx:19-24`)
   - `Promise.all([await fs.readFile(...), await fs.readFile(...)])` runs sequentially, defeating parallel execution. Remove inner `await`s.

2. **Wrong return type from `getSpeciesFromEnst`** (`app/(design-tool)/design-tool/[gene-and-isoform]/page.tsx:25-33`)
   - Returns `SpeciesOptions.Human` (an object `{value, label}`) but the prop expects `SpeciesValues` (a string). Should return `SpeciesValues.Human`.

3. **`<td scope="col">` in `<thead>`** (`app/(search)/genes/[symbol]/_components/isoform-card.tsx:24-35`)
   - Should be `<th scope="col">` for proper semantics/accessibility.

4. **Tooltip ID collision** (`app/(search)/genes/[symbol]/_components/copy-buttons.tsx`)
   - All CopyButton instances share `id="my-tooltip"`. Use unique IDs per instance.

5. **Memory leak in `downloadZip`** (`app/(design-tool)/_lib/download-zip.ts`)
   - `URL.createObjectURL` is never revoked. Add `URL.revokeObjectURL(fileURL)` after click.

6. **Promise constructor anti-pattern** (`gene-splitter-form.tsx:273-297`)
   - `handleSubmitForm` wraps `.then()` in `new Promise()`. Refactor to async/await.

7. **Hardcoded credentials** (`middleware.ts:15`)
   - `salk:gelp` is committed in source. Move to environment variables.

## Dependency Upgrades

### Major upgrades
- **Next.js** 13.4 → 15.x (params becomes async, metadata API changes)
- **React** 18.2 → 19.x (forwardRef no longer needed, ref is a regular prop)
- **Tailwind CSS** 3.3 → 4.x (CSS-first config, `@import` replaces `@tailwind`)
- **@headlessui/react** 1.x → 2.x (new component APIs, built-in transitions)
- **ESLint** 8 → 9 (flat config)
- **Prettier** 2 → 3

### Remove unused dependencies
- `papaparse` / `@types/papaparse` (not imported anywhere)
- `csv-loader` (not imported anywhere)
- `react-window` / `@types/react-window` (not imported anywhere)
- `swr` (not imported anywhere)

### Replace with modern alternatives
- `classnames` → `clsx` (smaller, same API)
- `copy-to-clipboard` → native `navigator.clipboard.writeText()`
- `react-tooltip` → remove (replace with simple CSS tooltip or title attr)

### Move to devDependencies
- `@types/node`, `@types/react`, `@types/react-dom`
- `eslint`, `eslint-config-next`
- `autoprefixer`, `postcss`, `typescript`

## Code Modernization

1. **Async params** (Next.js 15): Update all pages/layouts that destructure `params` to `await params`
   - `app/(search)/genes/[symbol]/page.tsx`
   - `app/(search)/genes/[symbol]/layout.tsx`
   - `app/(design-tool)/design-tool/[gene-and-isoform]/page.tsx`

2. **Remove `forwardRef`** (React 19): Refactor `Checkbox` to accept `ref` as a regular prop

3. **Tailwind v4 migration**: Convert config to CSS-based, update `globals.css`

4. **Headless UI v2 migration**: Update `GeneSearch` combobox to v2 API (removes the click hack)

5. **TypeScript config**: Update target from `es5` to `es2022`, moduleResolution to `bundler`

6. **Clean up ambient types**: Convert `types/*.d.ts` to proper exported types

7. **Prettier config**: Replace `require()` with ESM import

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Upgrade all deps, remove unused, restructure dev/prod |
| `tsconfig.json` | Update target, moduleResolution |
| `tailwind.config.js` | Remove (migrate to CSS-first in Tailwind v4) |
| `postcss.config.js` | Update for Tailwind v4 |
| `app/_styles/globals.css` | Tailwind v4 syntax |
| `middleware.ts` | Use env vars for credentials |
| `app/layout.tsx` | React 19 metadata types |
| `app/(search)/genes/[symbol]/page.tsx` | Async params, fix double await |
| `app/(search)/genes/[symbol]/layout.tsx` | Async params |
| `app/(search)/_components/gene-search.tsx` | Headless UI v2 API |
| `app/(search)/genes/[symbol]/_components/copy-buttons.tsx` | Native clipboard, remove react-tooltip |
| `app/(search)/genes/[symbol]/_components/isoform-card.tsx` | Fix th/td |
| `app/(design-tool)/design-tool/[gene-and-isoform]/page.tsx` | Async params, fix species type |
| `app/(design-tool)/_components/gene-splitter-form.tsx` | Async/await, fix promise |
| `app/(design-tool)/_lib/download-zip.ts` | Fix memory leak |
| `app/_components/checkbox.tsx` | Remove forwardRef (React 19) |
| `app/_components/button.tsx` | Replace classnames with clsx |
| `app/_components/header.tsx` | Replace classnames with clsx |
| `types/gene.d.ts` | Convert to proper module export |
| `types/isoform.d.ts` | Convert to proper module export |
| `.eslintrc.json` | Migrate to eslint.config.mjs (ESLint 9) |
| `prettier.config.js` | ESM syntax |

## Execution Order

1. Install new dependencies / remove unused ones
2. Update config files (tsconfig, tailwind, postcss, eslint, prettier)
3. Fix bugs (sequential fixes, can verify individually)
4. Code modernization (async params, forwardRef removal, headless UI v2, etc.)
5. Verify build succeeds

## Verification
- `npm run build` should complete without errors
- `npm run lint` should pass
- Manual: verify gene search, gene detail page, design tool form all render correctly
