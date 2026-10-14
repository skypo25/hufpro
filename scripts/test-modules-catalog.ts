/**
 * Smoke-Tests für Modul-Katalog / Resolver (ohne Test-Runner).
 * Ausführen: npx tsx scripts/test-modules-catalog.ts
 */
import {
  animalTypesForModules,
  modulesFromProfessions,
  moduleSupportsAnimalType,
} from '../lib/modules/catalog'
import { resolveModulesForAnimal } from '../lib/modules/resolve'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(modulesFromProfessions(['hufbearbeiter']).join() === 'hoof', 'huf→hoof')
assert(
  modulesFromProfessions(['hufbearbeiter', 'tierphysiotherapeut']).join() === 'hoof,physio',
  'multi map'
)
assert(modulesFromProfessions(['hufschmied']).join() === 'hoof', 'synonym hufschmied')
assert(animalTypesForModules(['hoof']).join() === 'horse', 'hoof animals')
assert(animalTypesForModules(['hoof', 'physio']).includes('dog'), 'union dog')
assert(moduleSupportsAnimalType('hoof', 'dog') === false, 'hoof no dog')
assert(moduleSupportsAnimalType('physio', 'cat') === true, 'physio cat')

const none = resolveModulesForAnimal(['hoof'], 'dog')
assert(none.status === 'none', 'hoof+dog → none')

const single = resolveModulesForAnimal(['hoof', 'physio'], 'cat')
assert(single.status === 'single' && single.moduleId === 'physio', 'cat → physio')

const choice = resolveModulesForAnimal(['hoof', 'physio'], 'horse')
assert(choice.status === 'choice' && choice.candidates.length === 2, 'horse → choice')

const pref = resolveModulesForAnimal(['hoof', 'physio'], 'horse', 'physio')
assert(pref.status === 'choice' && pref.candidates[0] === 'physio', 'preferred first')

console.log('OK: modules catalog + resolve')
