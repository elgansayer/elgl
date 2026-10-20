const fs = require('fs');
const content = fs.readFileSync('frontend/src/app/components/visual-diff/visual-diff.component.ts', 'utf8');
console.log(content.split('\n').filter(line => line.includes('VocabularyStore') || line.includes('FlashcardService') || line.includes('vocabStore')).join('\n'));
