const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

// Initialize React project with i18n structure
async function initialize(projectRoot) {
  console.log(chalk.blue('🚀 Initializing React project for internationalization...'));
  
  const i18nFile = path.join(projectRoot, 'src/i18n.js');
  
  // Create i18n.js file if it doesn't exist
  if (!await fs.pathExists(i18nFile)) {
    const i18nContent = `
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// English translations
const enTranslations = {
  common: {
    loading: 'Loading',
    error: 'Error',
    retry: 'Retry',
  },
  navigation: {
    home: 'Home',
    about: 'About',
    contact: 'Contact',
  },
};

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations
      }
    },
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
`;
    await fs.outputFile(i18nFile, i18nContent);
    console.log(chalk.green(`✓ Created i18n.js file at ${i18nFile}`));
  }
  
  // Check for react-i18next in package.json and install if needed
  try {
    const packagePath = path.join(projectRoot, 'package.json');
    const pkg = await fs.readJson(packagePath);
    
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (!deps['react-i18next'] || !deps['i18next'] || !deps['i18next-browser-languagedetector']) {
      console.log(chalk.yellow('⚠️ i18n dependencies not found in package.json.'));
      console.log(chalk.yellow('Please run: npm install --save react-i18next i18next i18next-browser-languagedetector'));
    }
  } catch (err) {
    console.error(chalk.red(`Error checking dependencies: ${err.message}`));
  }
  
  // Create an example component with i18n usage
  const exampleComponent = path.join(projectRoot, 'src/components/I18nExample.js');
  if (!await fs.pathExists(exampleComponent)) {
    const componentContent = `
import React from 'react';
import { useTranslation } from 'react-i18next';
import '../ResponsiveLanguage.css';

const I18nExample = () => {
  const { t, i18n } = useTranslation();
  
  const changeLanguage = (lang) => {
    i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  };
  
  return (
    <div className="i18n-example">
      <h2 className="lang-wrap">{t('navigation.home')}</h2>
      <p className="lang-wrap">{t('common.loading')}</p>
      
      <div className="language-buttons">
        <button className="lang-btn" onClick={() => changeLanguage('en')}>English</button>
        <button className="lang-btn" onClick={() => changeLanguage('es')}>Español</button>
        <button className="lang-btn" onClick={() => changeLanguage('zh')}>中文</button>
        <button className="lang-btn" onClick={() => changeLanguage('hi')}>हिंदी</button>
      </div>
    </div>
  );
};

export default I18nExample;
`;
    
    // Create components directory if it doesn't exist
    await fs.ensureDir(path.join(projectRoot, 'src/components'));
    await fs.outputFile(exampleComponent, componentContent);
    console.log(chalk.green(`✓ Created example component at ${exampleComponent}`));
  }
  
  return true;
}

// Analyze React project for strings and UI files
async function analyze(projectRoot, structure) {
  console.log(chalk.blue('🔍 Analyzing React components...'));
  
  const strings = new Set();
  const { uiFiles, i18nFile } = structure;
  
  // First check if i18n file exists and extract current translations
  let currentTranslations = {};
  if (await fs.pathExists(i18nFile)) {
    const content = await fs.readFile(i18nFile, 'utf8');
    
    // Extract existing English translations
    const enMatch = content.match(/const\s+enTranslations\s*=\s*\{([\s\S]*?)\};/);
    if (enMatch) {
      try {
        // Create a safe evaluation context
        const evalFn = new Function('return {' + enMatch[1] + '};');
        currentTranslations = evalFn();
      } catch (err) {
        console.warn(chalk.yellow(`⚠️ Could not parse existing translations: ${err.message}`));
        
        // Fallback to regex extraction
        const namespaceRegex = /(\w+):\s*{([^{}]*(?:{[^{}]*(?:{[^{}]*}[^{}]*)*}[^{}]*)*)}/g;
        let namespaceMatch;
        
        while ((namespaceMatch = namespaceRegex.exec(enMatch[1])) !== null) {
          const namespace = namespaceMatch[1];
          currentTranslations[namespace] = {};
          
          const keyValueRegex = /(\w+):\s*(['"])((?:\\\\|\\\2|.)*?)\2/g;
          let keyValueMatch;
          
          while ((keyValueMatch = keyValueRegex.exec(namespaceMatch[2])) !== null) {
            const key = keyValueMatch[1];
            const value = keyValueMatch[3].replace(/\\(['"])/g, '$1');
            currentTranslations[namespace][key] = value;
            strings.add(value);
          }
        }
      }
    }
  }
  
  // Now scan UI files for potential strings to translate
  for (const file of uiFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      
      // Look for hardcoded text in JSX
      const jsxTextRegex = />([^<>{}\n]+)</g;
      let match;
      
      while ((match = jsxTextRegex.exec(content)) !== null) {
        const text = match[1].trim();
        if (text && text.length > 1 && !/^\d+$/.test(text) && !text.includes('${')) {
          strings.add(text);
        }
      }
      
      // Look for hardcoded text in JSX attributes (e.g., placeholder, title, alt)
      const jsxAttributeRegex = /(?:placeholder|title|alt|aria-label)=['"](.*?)['"]|(?:placeholder|title|alt|aria-label)=\{['"](.*?)['"]\}/g;
      while ((match = jsxAttributeRegex.exec(content)) !== null) {
        const text = (match[1] || match[2])?.trim();
        if (text && text.length > 1 && !/^\d+$/.test(text) && !text.includes('${')) {
          strings.add(text);
        }
      }
    } catch (err) {
      console.warn(chalk.yellow(`⚠️ Could not analyze file ${file}: ${err.message}`));
    }
  }
  
  return {
    strings: Array.from(strings),
    uiFiles,
    currentTranslations
  };
}

// Update translations in React project
async function updateTranslations(structure, translations, language, forceAll) {
  console.log(chalk.blue(`📝 Updating React translations for ${language}...`));
  
  const { i18nFile } = structure;
  
  if (!await fs.pathExists(i18nFile)) {
    throw new Error(`i18n file not found: ${i18nFile}`);
  }
  
  const content = await fs.readFile(i18nFile, 'utf8');
  
  // Check if the target language translation object already exists
  const langRegex = new RegExp(`const\\s+${language}Translations\\s*=\\s*\\{[\\s\\S]*?\\};`);
  let updatedContent;
  
  if (langRegex.test(content)) {
    // Update existing translations
    if (forceAll) {
      // Replace entire translation object
      updatedContent = content.replace(
        langRegex,
        `const ${language}Translations = ${JSON.stringify(translations, null, 2)};`
      );
    } else {
      // Merge with existing translations
      const existingMatch = content.match(langRegex);
      if (existingMatch) {
        try {
          const evalFn = new Function(`return ${existingMatch[0].replace(`const ${language}Translations =`, '')}`);
          const existingTranslations = evalFn();
          
          // Deep merge
          const mergedTranslations = { ...existingTranslations };
          Object.keys(translations).forEach(namespace => {
            mergedTranslations[namespace] = {
              ...(mergedTranslations[namespace] || {}),
              ...translations[namespace]
            };
          });
          
          updatedContent = content.replace(
            langRegex,
            `const ${language}Translations = ${JSON.stringify(mergedTranslations, null, 2)};`
          );
        } catch (err) {
          console.warn(chalk.yellow(`⚠️ Error merging translations: ${err.message}`));
          // Fallback to replacement
          updatedContent = content.replace(
            langRegex,
            `const ${language}Translations = ${JSON.stringify(translations, null, 2)};`
          );
        }
      }
    }
  } else {
    // Add new language translations
    updatedContent = content.replace(
      /(const \w+Translations = {[\s\S]*?};)([\s\S]*?)(i18n)/,
      `$1\n\n// ${language === 'es' ? 'Spanish' : language === 'zh' ? 'Chinese' : language === 'hi' ? 'Hindi' : language} translations\nconst ${language}Translations = ${JSON.stringify(translations, null, 2)};$2$3`
    );
    
    // Also add to resources section
    updatedContent = updatedContent.replace(
      /(resources: {\s*.*?\s*en: {[\s\S]*?})(,?\s*)(})/,
      `$1,\n      ${language}: {\n        translation: ${language}Translations\n      }$3`
    );
  }
  
  // Create backup
  const backupPath = `${i18nFile}.backup-${Date.now()}`;
  await fs.copy(i18nFile, backupPath);
  
  // Write updated file
  await fs.writeFile(i18nFile, updatedContent);
  console.log(chalk.green(`✓ Updated translations in ${i18nFile}`));
  
  return true;
}

// Update UI for language responsiveness
async function updateUI(structure, uiFiles) {
  console.log(chalk.blue('🎨 Updating React UI components for language responsiveness...'));
  
  const { responsiveCssFile } = structure;
  
  // Ensure responsive CSS exists
  if (!await fs.pathExists(responsiveCssFile)) {
    const cssContent = await fs.readFile(path.join(__dirname, '../styles/responsive-language.css'), 'utf8');
    await fs.outputFile(responsiveCssFile, cssContent);
    console.log(chalk.green(`✓ Created ResponsiveLanguage.css at ${responsiveCssFile}`));
  }
  
  // Find App.js or equivalent to make sure it imports the CSS
  const appFile = uiFiles.find(file => 
    path.basename(file) === 'App.js' || 
    path.basename(file) === 'App.jsx' || 
    path.basename(file) === 'app.js'
  );
  
  if (appFile) {
    const content = await fs.readFile(appFile, 'utf8');
    if (!content.includes('ResponsiveLanguage.css')) {
      const updatedContent = content.replace(
        /(import\s+.*\s+from\s+['"][^'"]+['"];)(\s*)/,
        `$1\nimport './ResponsiveLanguage.css'; // Added for language-responsive UI$2`
      );
      await fs.writeFile(appFile, updatedContent);
      console.log(chalk.green(`✓ Added CSS import to ${appFile}`));
    }
  }
  
  // Process each UI file
  for (const file of uiFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      let updatedContent = content;
      let changesMade = false;
      
      // Find components that need to be language-responsive
      
      // 1. Buttons
      const buttonPattern = /<button([^>]*)>([^<]+)<\/button>/g;
      updatedContent = updatedContent.replace(buttonPattern, (match, attrs, text) => {
        if (!attrs.includes('className="lang-btn"') && 
            !attrs.includes('className={') && 
            text.trim().length > 0) {
          changesMade = true;
          return `<button${attrs} className="lang-btn">${text}</button>`;
        } else if (attrs.includes('className="') && 
                  !attrs.includes('lang-btn') && 
                  text.trim().length > 0) {
          changesMade = true;
          return `<button${attrs.replace('className="', 'className="lang-btn ')}>${text}</button>`;
        }
        return match;
      });
      
      // 2. Text elements
      const textElementPattern = /(<(?:p|span|div|h[1-6])[^>]*>)([^<>{}\n]+)(<\/(?:p|span|div|h[1-6])>)/g;
      updatedContent = updatedContent.replace(textElementPattern, (match, opening, content, closing) => {
        const trimmedContent = content.trim();
        if (trimmedContent.length === 0 || opening.includes('lang-wrap')) {
          return match;
        }
        
        changesMade = true;
        if (!opening.includes('className=')) {
          return `${opening.replace('>', ' className="lang-wrap">')}${content}${closing}`;
        } else if (opening.includes('className="')) {
          return opening.replace('className="', 'className="lang-wrap ') + content + closing;
        }
        return match;
      });
      
      // 3. Language switcher code - add HTML lang attribute
      if (content.includes('changeLanguage') && !content.includes('document.documentElement.lang')) {
        const langSwitcherPattern = /(const changeLanguage\s*=\s*\([^)]*\)\s*=>\s*\{\s*)(.*?i18n\.changeLanguage\([^)]*\);)/;
        updatedContent = updatedContent.replace(langSwitcherPattern, (match, prefix, changeFn) => {
          changesMade = true;
          return `${prefix}${changeFn}\n    document.documentElement.lang = langCode;`;
        });
      }
      
      if (changesMade) {
        await fs.writeFile(file, updatedContent);
        console.log(chalk.green(`✓ Updated ${path.basename(file)} for language responsiveness`));
      }
    } catch (err) {
      console.warn(chalk.yellow(`⚠️ Could not update file ${file}: ${err.message}`));
    }
  }
  
  return true;
}

module.exports = {
  initialize,
  analyze,
  updateTranslations,
  updateUI
};