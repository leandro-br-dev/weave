#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const enUSDir = '/root/projects/weave/dashboard/src/locales/en-US';
const ptBRDir = '/root/projects/weave/dashboard/src/locales/pt-BR';

// Recursively get all keys from an object
function getAllKeys(obj, prefix = '') {
  const keys = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

// Count all keys in an object
function countKeys(obj) {
  let count = 0;

  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      count += countKeys(obj[key]);
    } else {
      count++;
    }
  }

  return count;
}

// Get file size
function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size;
}

// Read and parse JSON file
function readJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

// Main comparison function
function compareTranslations() {
  const enUSFiles = fs.readdirSync(enUSDir).filter(f => f.endsWith('.json'));
  const ptBRFiles = fs.readdirSync(ptBRDir).filter(f => f.endsWith('.json'));

  console.log('='.repeat(80));
  console.log('TRANSLATION COMPARISON REPORT: en-US vs pt-BR');
  console.log('='.repeat(80));
  console.log();

  // Check for missing files in pt-BR
  const missingFiles = enUSFiles.filter(f => !ptBRFiles.includes(f));
  if (missingFiles.length > 0) {
    console.log('❌ MISSING FILES in pt-BR:');
    missingFiles.forEach(f => console.log(`  - ${f}`));
    console.log();
  }

  // Check for extra files in pt-BR
  const extraFiles = ptBRFiles.filter(f => !enUSFiles.includes(f));
  if (extraFiles.length > 0) {
    console.log('⚠️  EXTRA FILES in pt-BR (not in en-US):');
    extraFiles.forEach(f => console.log(`  - ${f}`));
    console.log();
  }

  // Compare each file
  const results = [];
  let totalEnUSKeys = 0;
  let totalPtBRKeys = 0;

  for (const file of enUSFiles) {
    const enUSPath = path.join(enUSDir, file);
    const ptBRPath = path.join(ptBRDir, file);

    const enUSData = readJson(enUSPath);
    const ptBRData = readJson(ptBRPath);

    if (!enUSData) continue;

    const enUSKeys = enUSData ? getAllKeys(enUSData) : [];
    const ptBRKeys = ptBRData ? getAllKeys(ptBRData) : [];

    const enUSKeyCount = enUSData ? countKeys(enUSData) : 0;
    const ptBRKeyCount = ptBRData ? countKeys(ptBRData) : 0;

    totalEnUSKeys += enUSKeyCount;
    totalPtBRKeys += ptBRKeyCount;

    const enUSSize = getFileSize(enUSPath);
    const ptBRSize = ptBRData ? getFileSize(ptBRPath) : 0;

    const missingKeys = enUSKeys.filter(k => !ptBRKeys.includes(k));
    const extraKeys = ptBRKeys.filter(k => !enUSKeys.includes(k));

    results.push({
      file,
      enUSKeyCount,
      ptBRKeyCount,
      enUSSize,
      ptBRSize,
      missingKeys,
      extraKeys,
      hasPtBR: !!ptBRData
    });
  }

  // Display summary
  console.log('📊 SUMMARY:');
  console.log(`  Total en-US keys: ${totalEnUSKeys}`);
  console.log(`  Total pt-BR keys: ${totalPtBRKeys}`);
  console.log(`  Coverage: ${((totalPtBRKeys / totalEnUSKeys) * 100).toFixed(1)}%`);
  console.log();

  // Display detailed results for each file
  console.log('📁 FILE-BY-FILE COMPARISON:');
  console.log('-'.repeat(80));

  for (const result of results) {
    console.log(`\n📄 ${result.file}`);
    console.log(`   en-US: ${result.enUSKeyCount} keys, ${result.enUSSize} bytes`);
    console.log(`   pt-BR: ${result.hasPtBR ? `${result.ptBRKeyCount} keys, ${result.ptBRSize} bytes` : 'MISSING'}`);

    if (result.hasPtBR) {
      const coverage = ((result.ptBRKeyCount / result.enUSKeyCount) * 100).toFixed(1);
      console.log(`   Coverage: ${coverage}%`);
    }

    if (result.missingKeys.length > 0) {
      console.log(`   ❌ MISSING KEYS (${result.missingKeys.length}):`);
      result.missingKeys.slice(0, 10).forEach(k => console.log(`      - ${k}`));
      if (result.missingKeys.length > 10) {
        console.log(`      ... and ${result.missingKeys.length - 10} more`);
      }
    }

    if (result.extraKeys.length > 0) {
      console.log(`   ⚠️  EXTRA KEYS (${result.extraKeys.length}):`);
      result.extraKeys.slice(0, 5).forEach(k => console.log(`      - ${k}`));
      if (result.extraKeys.length > 5) {
        console.log(`      ... and ${result.extraKeys.length - 5} more`);
      }
    }

    if (result.missingKeys.length === 0 && result.extraKeys.length === 0 && result.hasPtBR) {
      console.log('   ✅ Complete match!');
    }
  }

  console.log();
  console.log('='.repeat(80));

  // Generate list of all missing keys for easy reference
  const allMissingKeys = results.flatMap(r =>
    r.missingKeys.map(k => `${r.file}:${k}`)
  );

  if (allMissingKeys.length > 0) {
    console.log('\n📋 ALL MISSING KEYS (for translation):');
    console.log('-'.repeat(80));
    allMissingKeys.forEach(k => console.log(k));
    console.log(`\nTotal: ${allMissingKeys.length} missing keys`);
  }

  console.log('\n' + '='.repeat(80));
}

compareTranslations();
