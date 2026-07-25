/**
 * Obfuscation Script
 * 
 * Obfuscates license.js, server.js, and reset_for_client.js
 * using JavaScript obfuscation techniques:
 *  - String encoding (Base64/hex)
 *  - Variable renaming
 *  - Control flow flattening
 * 
 * Usage: node obfuscate.js
 */

const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const filesToObfuscate = ['license.js', 'server.js', 'reset_for_client.js'];
const outputDir = path.join(__dirname, '..');

const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  identifiersPrefix: '',
  inputFileName: '',
  log: false,
  renameGlobals: false,
  renameProperties: false,
  renamePropertiesMode: 'safe',
  reservedNames: [],
  reservedStrings: [],
  selfDefending: true,
  shuffleStringArray: true,
  sourceMap: false,
  sourceMapMode: 'separate',
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.5,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  target: 'node',
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
};

console.log('═══════════════════════════════════════════');
console.log('  JavScript Obfuscator');
console.log('═══════════════════════════════════════════');
console.log('');

for (const file of filesToObfuscate) {
  const inputPath = path.join(rootDir, file);
  
  if (!fs.existsSync(inputPath)) {
    console.warn(`⚠  Skipping ${file}: file not found`);
    continue;
  }

  console.log(`▶  Obfuscating ${file}...`);

  try {
    const sourceCode = fs.readFileSync(inputPath, 'utf8');
    
    const obfuscatedCode = JavaScriptObfuscator.obfuscate(sourceCode, obfuscationOptions).getObfuscatedCode();
    
    // Add a header comment
    const header = '// Doctor Clinic Portable — Obfuscated\n// Do not modify this file.\n\n';
    fs.writeFileSync(inputPath, header + obfuscatedCode, 'utf8');
    
    console.log(`   ✓ ${file} obfuscated (${sourceCode.length} → ${obfuscatedCode.length} chars)`);
  } catch (err) {
    console.error(`   ✗ Error obfuscating ${file}: ${err.message}`);
  }
}

console.log('');
console.log('✓ All files obfuscated successfully!');
