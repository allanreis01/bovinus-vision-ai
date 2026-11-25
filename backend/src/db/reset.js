/** `npm run seed` — recria o banco com os dados realistas da Unidade Augusta. */
import { seedDatabase } from './seed.js';
import { getDb, getDriver, closeDb } from './index.js';

getDb();
seedDatabase();
const n = getDb().prepare('SELECT COUNT(*) AS n, ROUND(AVG(peso_g), 1) AS media FROM pratos').get();
console.log(`✔ Banco recriado (${getDriver()}): ${n.n} pratos, peso médio ${n.media} g`);
closeDb();
