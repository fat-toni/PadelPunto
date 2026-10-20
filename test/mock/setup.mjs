// Loaded with node --import before the tests, see "test" in package.json.
import { register } from 'node:module'

register('./hooks.mjs', import.meta.url)
