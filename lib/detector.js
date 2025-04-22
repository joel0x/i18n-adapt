const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const chalk = require('chalk');

// Detect which framework the project uses
async function detectFramework(projectRoot) {
  console.log(chalk.blue('🔍 Detecting project framework...'));
  
  // Check package.json
  try {
    const packagePath = path.join(projectRoot, 'package.json');
    if (await fs.pathExists(packagePath)) {
      const pkg = await fs.readJson(packagePath);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      if (deps.react) return 'react';
      if (deps.vue) return 'vue';
      if (deps['@angular/core']) return 'angular';
    }
  } catch (err) {
    // Continue with other detection methods
  }
  
  // Check for framework-specific files
  if (await fs.pathExists(path.join(projectRoot, 'angular.json'))) return 'angular';
  if (await fs.pathExists(path.join(projectRoot, 'vue.config.js'))) return 'vue';
  
  // Check for common directories and file extensions
  const jsxFiles = glob.sync('src/**/*.jsx', { cwd: projectRoot });
  const vueFiles = glob.sync('src/**/*.vue', { cwd: projectRoot });
  const tsFiles = glob.sync('src/**/*.ts', { cwd: projectRoot });
  
  if (vueFiles.length > 0) return 'vue';
  if (jsxFiles.length > 0) return 'react';
  if (tsFiles.length > 0 && await fs.pathExists(path.join(projectRoot, 'src/app'))) return 'angular';
  
  // Default to React if unsure
  return 'react';
}

// Detect project structure based on framework
async function detectStructure(projectRoot, framework) {
  console.log(chalk.blue('🔍 Detecting project structure...'));
  
  // Common patterns for i18n files
  const i18nPatterns = {
    react: [
      'src/i18n.js', 
      'src/i18n/index.js', 
      'src/translations/index.js',
      'src/locales/index.js'
    ],
    vue: [
      'src/i18n.js',
      'src/plugins/i18n.js',
      'src/locales/index.js'
    ],
    angular: [
      'src/assets/i18n',
      'src/app/i18n',
      'src/locales'
    ]
  };
  
  // Find i18n file
  let i18nFile = null;
  for (const pattern of i18nPatterns[framework]) {
    const filePath = path.join(projectRoot, pattern);
    if (await fs.pathExists(filePath)) {
      i18nFile = filePath;
      console.log(chalk.green(`✓ Found i18n file/directory: ${filePath}`));
      break;
    }
  }
  
  // If not found, need to create one
  if (!i18nFile) {
    switch (framework) {
      case 'react':
        i18nFile = path.join(projectRoot, 'src/i18n.js');
        break;
      case 'vue':
        i18nFile = path.join(projectRoot, 'src/i18n.js');
        break;
      case 'angular':
        i18nFile = path.join(projectRoot, 'src/assets/i18n');
        break;
    }
    console.log(chalk.yellow(`⚠️ No i18n file found. Will create: ${i18nFile}`));
  }
  
  // Find UI component files
  const uiPatterns = {
    react: ['src/**/*.js', 'src/**/*.jsx', 'src/**/*.tsx'],
    vue: ['src/**/*.vue'],
    angular: ['src/**/*.html', 'src/**/*.ts']
  };
  
  const uiFiles = [];
  for (const pattern of uiPatterns[framework]) {
    const files = glob.sync(pattern, { cwd: projectRoot });
    files.forEach(file => {
      uiFiles.push(path.join(projectRoot, file));
    });
  }
  
  console.log(chalk.green(`✓ Found ${uiFiles.length} UI files to analyze`));
  
  return {
    i18nFile,
    responsiveCssFile: path.join(projectRoot, 'src/ResponsiveLanguage.css'),
    uiFiles,
    rootDir: projectRoot
  };
}

module.exports = {
  detectFramework,
  detectStructure
};