// Lets Node load the app's modules: @zos/fs comes from fs.mjs, every other @zos module from
// zos.mjs, and relative imports without extension (as the Zepp build allows) get ".js",
// or "/index.js" for a folder.
import { existsSync } from 'node:fs'

export async function resolve(specifier, context, next) {
  if (specifier === '@zos/fs') return { url: new URL('./fs.mjs', import.meta.url).href, shortCircuit: true }
  if (specifier.startsWith('@zos/')) return { url: new URL('./zos.mjs', import.meta.url).href, shortCircuit: true }
  if (specifier.startsWith('.') && !/\.m?js$/.test(specifier)) {
    const asFile = new URL(specifier + '.js', context.parentURL)
    return next(existsSync(asFile) ? specifier + '.js' : specifier + '/index.js', context)
  }
  return next(specifier, context)
}
