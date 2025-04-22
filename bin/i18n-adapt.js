#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { 
  init, 
  analyze, 
  generateTranslations, 
  updateUI 
} = require('../lib/index');

program
  .name('i18n-adapt')
  .description('Automatically internationalize and adapt UI for multiple languages')
  .version('1.0.0')
  .option('-l, --language <code>', 'target language code (es, zh, hi, etc.)', 'es')
  .option('-k, --key <apiKey>', 'Translation API key')
  .option('-p, --path <projectPath>', 'path to project root', '.')
  .option('-f, --force-all', 'force retranslation of all strings', false)
  .option('--no-ui-fix', 'skip UI responsiveness fixes', false)
  .option('--service <service>', 'translation service (gemini, google, azure)', 'gemini')
  .option('--extract-only', 'only extract strings, no translation', false)
  .option('--init-only', 'only initialize i18n structure', false);

program.parse();

const options = program.opts();

async function main() {
  try {
    console.log(chalk.blue('🌍 i18n-adapt - Internationalization Automation Tool'));
    
    if (options.initOnly) {
      await init(options.path);
      console.log(chalk.green('✅ Project initialized for internationalization'));
      return;
    }
    
    const analysis = await analyze(options.path);
    console.log(chalk.blue(`📊 Analysis complete: Found ${analysis.strings.length} strings, framework: ${analysis.framework}`));
    
    if (!options.extractOnly) {
      await generateTranslations(analysis, options.language, options.key, options.service, options.forceAll);
    }
    
    if (options.uiFix) {
      await updateUI(analysis);
      console.log(chalk.green('✓ UI updated for language responsiveness'));
    }
    
    console.log(chalk.green('\n✅ Internationalization complete!'));
  } catch (err) {
    console.error(chalk.red(`❌ Error: ${err.message}`));
    process.exit(1);
  }
}

main();