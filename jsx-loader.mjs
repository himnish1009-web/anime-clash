// Lets `node` import .jsx directly by transpiling with the esbuild that ships
// with Vite. Used by the DOM smoke test only.
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'

export async function load(url, context, nextLoad) {
  if (url.endsWith('.jsx') && !url.includes('node_modules')) {
    const source = readFileSync(new URL(url), 'utf8')
    const { code } = transformSync(source, { loader: 'jsx', format: 'esm', jsx: 'automatic' })
    return { format: 'module', source: code, shortCircuit: true }
  }
  return nextLoad(url, context)
}
