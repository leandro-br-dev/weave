/**
 * Comprehensive i18n Verification Script
 * This script checks for:
 * 1. Missing translation keys
 * 2. Hardcoded text in components
 * 3. Translation key consistency between languages
 */

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'dashboard/src/locales');
const srcDir = path.join(__dirname, 'dashboard/src');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

// Helper function to get all keys from a nested object
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

// Load JSON file
function loadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    log(colors.red, `❌ Error loading ${filePath}: ${error.message}`);
    return null;
  }
}

// Recursively get all JSON files in a directory
function getJSONFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getJSONFiles(filePath, fileList);
    } else if (file.endsWith('.json')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// Check for hardcoded text in TSX files
function findHardcodedText(dir) {
  const issues = [];
  const files = [];

  // Recursively find all TSX files
  function findTSXFiles(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    entries.forEach(entry => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        findTSXFiles(fullPath);
      } else if (entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    });
  }

  findTSXFiles(dir);

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    // Check for hardcoded Portuguese comments
    lines.forEach((line, index) => {
      if (/\{\/\*.*[áàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ].*\*\/\}/.test(line)) {
        issues.push({
          file: file.replace(__dirname, ''),
          line: index + 1,
          type: 'Portuguese comment',
          text: line.trim(),
        });
      }
    });

    // Check for hardcoded title attributes with English text
    lines.forEach((line, index) => {
      if (/title="[A-Z][a-z]+"/.test(line) && !line.includes('t(')) {
        issues.push({
          file: file.replace(__dirname, ''),
          line: index + 1,
          type: 'Hardcoded title attribute',
          text: line.trim(),
        });
      }
    });
  });

  return issues;
}

// Main verification function
function verifyI18n() {
  log(colors.cyan, '\n🔍 Starting Comprehensive i18n Verification\n');
  log(colors.blue, '=' .repeat(60));

  // Get all locale files
  const enUSFiles = getJSONFiles(path.join(localesDir, 'en-US'));
  const ptBRFiles = getJSONFiles(path.join(localesDir, 'pt-BR'));

  log(colors.yellow, `\n📁 Found ${enUSFiles.length} en-US translation files`);
  log(colors.yellow, `📁 Found ${ptBRFiles.length} pt-BR translation files`);

  // Check for missing keys between languages
  log(colors.cyan, '\n🔑 Checking translation key consistency...\n');

  let allChecksPassed = true;
  let totalKeys = 0;
  let missingKeys = [];

  enUSFiles.forEach(enFile => {
    const relativePath = enFile.replace(path.join(localesDir, 'en-US/'), '');
    const ptFile = path.join(localesDir, 'pt-BR', relativePath);

    if (!fs.existsSync(ptFile)) {
      log(colors.red, `❌ Missing pt-BR file: ${relativePath}`);
      allChecksPassed = false;
      return;
    }

    const enData = loadJSON(enFile);
    const ptData = loadJSON(ptFile);

    if (!enData || !ptData) return;

    const enKeys = getAllKeys(enData);
    const ptKeys = getAllKeys(ptData);

    totalKeys += enKeys.length;

    // Check for keys in en-US but not in pt-BR
    enKeys.forEach(key => {
      if (!ptKeys.includes(key)) {
        missingKeys.push({
          file: relativePath,
          key: key,
          missingIn: 'pt-BR'
        });
        allChecksPassed = false;
      }
    });

    // Check for keys in pt-BR but not in en-US
    ptKeys.forEach(key => {
      if (!enKeys.includes(key)) {
        missingKeys.push({
          file: relativePath,
          key: key,
          missingIn: 'en-US'
        });
        allChecksPassed = false;
      }
    });
  });

  if (missingKeys.length > 0) {
    log(colors.red, `\n❌ Found ${missingKeys.length} missing translation keys:\n`);
    missingKeys.forEach(({ file, key, missingIn }) => {
      log(colors.red, `   ${file}: "${key}" missing in ${missingIn}`);
    });
  } else {
    log(colors.green, `✅ All ${totalKeys} translation keys are consistent!`);
  }

  // Check for hardcoded text
  log(colors.cyan, '\n🔍 Checking for hardcoded text in components...\n');

  const hardcodedIssues = findHardcodedText(srcDir);

  if (hardcodedIssues.length > 0) {
    log(colors.red, `❌ Found ${hardcodedIssues.length} hardcoded text issues:\n`);
    hardcodedIssues.forEach(issue => {
      log(colors.yellow, `   ${issue.file}:${issue.line}`);
      log(colors.red, `   Type: ${issue.type}`);
      log(colors.red, `   ${issue.text}\n`);
    });
    allChecksPassed = false;
  } else {
    log(colors.green, '✅ No hardcoded text found in components!');
  }

  // Summary
  log(colors.blue, '\n' + '='.repeat(60));
  log(colors.cyan, '\n📊 Summary Report\n');

  if (allChecksPassed) {
    log(colors.green, '✅ All i18n checks passed!');
    log(colors.green, `✅ ${totalKeys} translation keys verified`);
    log(colors.green, '✅ No hardcoded text found');
  } else {
    log(colors.red, '❌ Some i18n checks failed:');
    if (missingKeys.length > 0) {
      log(colors.red, `   - ${missingKeys.length} missing translation keys`);
    }
    if (hardcodedIssues.length > 0) {
      log(colors.red, `   - ${hardcodedIssues.length} hardcoded text issues`);
    }
  }

  log(colors.cyan, '\n📝 Translation Coverage:');
  const coverage = ((totalKeys - missingKeys.length) / totalKeys * 100).toFixed(1);
  log(colors.cyan, `   Coverage: ${coverage}% (${totalKeys - missingKeys.length}/${totalKeys} keys)`);

  // Recommendations
  if (!allChecksPassed) {
    log(colors.cyan, '\n💡 Recommendations:\n');

    if (hardcodedIssues.some(i => i.type === 'Portuguese comment')) {
      log(colors.yellow, '   • Remove or translate Portuguese comments in components');
    }
    if (hardcodedIssues.some(i => i.type === 'Hardcoded title attribute')) {
      log(colors.yellow, '   • Replace hardcoded title attributes with translation keys');
    }
    if (missingKeys.length > 0) {
      log(colors.yellow, '   • Add missing translation keys to both language files');
    }
  }

  log(colors.blue, '\n' + '='.repeat(60) + '\n');

  return allChecksPassed;
}

// Run verification
const success = verifyI18n();
process.exit(success ? 0 : 1);
