const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { detectFramework, detectStructure } = require('./detector');
const { translateStrings } = require('./languages/processors');
const reactAdapter = require('./frameworks/react');
const vueAdapter = require('./frameworks/vue');
const angularAdapter = require('./frameworks/angular');

// Initialize a project with i18n structure
async function init(projectPath) {
  const resolvedPath = path.resolve(projectPath);
  const framework = await detectFramework(resolvedPath);
  
  console.log(chalk.blue(`🔍 Detected ${framework} framework`));
  
  // Create appropriate initialization based on framework
  switch (framework) {
    case 'react':
      await reactAdapter.initialize(resolvedPath);
      break;
    case 'vue':
      await vueAdapter.initialize(resolvedPath);
      break;
    case 'angular':
      await angularAdapter.initialize(resolvedPath);
      break;
    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }
  
  // Copy responsive CSS file
  const cssDir = path.join(resolvedPath, 'src');
  await fs.ensureDir(cssDir);
  await fs.copyFile(
    path.join(__dirname, 'styles/responsive-language.css'),
    path.join(cssDir, 'ResponsiveLanguage.css')
  );
  
  return true;
}

// Analyze project for internationalization
async function analyze(projectPath) {
  const resolvedPath = path.resolve(projectPath);
  const framework = await detectFramework(resolvedPath);
  const structure = await detectStructure(resolvedPath, framework);
  
  let strings = [];
  let uiFiles = [];
  
  console.log(chalk.blue('📊 Analyzing project files...'));
  
  // Use framework-specific adapter for analysis
  switch (framework) {
    case 'react':
      const reactResult = await reactAdapter.analyze(resolvedPath, structure);
      strings = reactResult.strings;
      uiFiles = reactResult.uiFiles;
      break;
    case 'vue':
      const vueResult = await vueAdapter.analyze(resolvedPath, structure);
      strings = vueResult.strings;
      uiFiles = vueResult.uiFiles;
      break;
    case 'angular':
      const angularResult = await angularAdapter.analyze(resolvedPath, structure);
      strings = angularResult.strings;
      uiFiles = angularResult.uiFiles;
      break;
    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }
  
  return {
    framework,
    structure,
    strings,
    uiFiles,
    i18nFile: structure.i18nFile,
    responsiveCssFile: structure.responsiveCssFile
  };
}

// Generate translations for detected strings
async function generateTranslations(analysis, language, apiKey, service, forceAll) {
  console.log(chalk.blue(`🌐 Generating translations for ${language}...`));
  
  const { framework, strings, structure } = analysis;
  
  // Translate strings using the specified service
  const translations = await translateStrings(strings, language, apiKey, service);
  
  // Use framework-specific adapter to update i18n files
  switch (framework) {
    case 'react':
      await reactAdapter.updateTranslations(structure, translations, language, forceAll);
      break;
    case 'vue':
      await vueAdapter.updateTranslations(structure, translations, language, forceAll);
      break;
    case 'angular':
      await angularAdapter.updateTranslations(structure, translations, language, forceAll);
      break;
    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }
  
  return translations;
}

// Update UI for language responsiveness
async function updateUI(analysis) {
  console.log(chalk.blue('🎨 Updating UI for language responsiveness...'));
  
  const { framework, uiFiles, structure } = analysis;
  
  // Use framework-specific adapter to update UI files
  switch (framework) {
    case 'react':
      await reactAdapter.updateUI(structure, uiFiles);
      break;
    case 'vue':
      await vueAdapter.updateUI(structure, uiFiles);
      break;
    case 'angular':
      await angularAdapter.updateUI(structure, uiFiles);
      break;
    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }
  
  return true;
}

module.exports = {
  init,
  analyze,
  generateTranslations,
  updateUI
};