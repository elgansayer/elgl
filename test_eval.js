const fs = require('fs');
const content = fs.readFileSync('backend/src/media/media.service.ts', 'utf8');
console.log(content.includes('import * as crypto from \'crypto\';'));
