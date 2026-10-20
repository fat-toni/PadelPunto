// Stand-in for @zos/fs in Node tests: files live in globalThis.zosFiles (a Map);
// set globalThis.zosFull = true to make every write fail like a full storage.
globalThis.zosFiles = globalThis.zosFiles || new Map()

export function readFileSync({ path }) {
  if (!globalThis.zosFiles.has(path)) throw new Error('ENOENT')
  return globalThis.zosFiles.get(path)
}

export function writeFileSync({ path, data }) {
  if (globalThis.zosFull) throw new Error('ENOSPC')
  globalThis.zosFiles.set(path, data)
  const cost = globalThis.zos && globalThis.zos.cost
  if (cost) {
    cost.writes++
    cost.bytes += data.length
  }
}

export function rmSync({ path }) {
  globalThis.zosFiles.delete(path)
}

export function statSync({ path }) {
  if (!globalThis.zosFiles.has(path)) return undefined
  return { size: Buffer.byteLength(globalThis.zosFiles.get(path), 'utf8') }
}
