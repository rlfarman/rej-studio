// Project lint rules that Oxlint has no native equivalent for, run through
// its ESLint-compatible JS plugin API (`lint.jsPlugins` in vite.config.ts).
//
// Plain ESLint plugin shape, so the rules also work under ESLint if we ever
// need it.

const RHF_WATCH_MESSAGE =
  "react-hook-form's watch() goes stale under the React Compiler. Use useWatch({ control, name }), or getValues() for a one-off read."

/**
 * The React Compiler memoizes react-hook-form's `watch()` (its identity never
 * changes), so a component reading it renders stale values. Oxlint's
 * `react/incompatible-library` only catches `watch` on `useForm()`, not on
 * `useFormContext()`, and the form fields read their values through the
 * context.
 *
 * Replaces ESLint's `no-restricted-syntax` with these two selectors:
 *   VariableDeclarator[init.callee.name=/^useForm(Context)?$/] > ObjectPattern > Property[key.name='watch']
 *   CallExpression[callee.type='MemberExpression'][callee.property.name='watch']
 */
const noRhfWatch = {
  meta: {
    type: 'problem',
    docs: { description: "Disallow react-hook-form's watch()" },
    messages: { watch: RHF_WATCH_MESSAGE },
    schema: [],
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        const init = node.init
        if (
          init?.type !== 'CallExpression' ||
          init.callee.type !== 'Identifier' ||
          !/^useForm(Context)?$/.test(init.callee.name) ||
          node.id.type !== 'ObjectPattern'
        ) {
          return
        }
        for (const property of node.id.properties) {
          if (
            property.type === 'Property' &&
            property.key.type === 'Identifier' &&
            property.key.name === 'watch'
          ) {
            context.report({ node: property, messageId: 'watch' })
          }
        }
      },
      CallExpression(node) {
        const callee = node.callee
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'watch'
        ) {
          context.report({ node, messageId: 'watch' })
        }
      },
    }
  },
}

export default {
  meta: { name: 'rej' },
  rules: { 'no-rhf-watch': noRhfWatch },
}
