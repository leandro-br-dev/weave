const Database = require('better-sqlite3');
const db = new Database('./api/data/database.db');

// Check environments table schema
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='environments'").get();
console.log('Environments table schema:');
console.log(schema.sql);

// Check if git_repository column exists
const columns = db.prepare("PRAGMA table_info(environments)").all();
console.log('\nColumns in environments table:');
columns.forEach(col => {
  console.log(`  - ${col.name} (${col.type})`);
});

const hasGitRepo = columns.some(col => col.name === 'git_repository');
console.log(`\ngit_repository column exists: ${hasGitRepo ? 'YES ✅' : 'NO ❌'}`);

db.close();
