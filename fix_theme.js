const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach((f) => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const colorMap = {
  'bg-amber-50': 'bg-amber-500/10',
  'bg-amber-100': 'bg-amber-500/20',
  'text-amber-800': 'text-amber-400',
  'text-amber-900': 'text-amber-400',
  'border-amber-200': 'border-amber-500/30',
  'border-amber-300': 'border-amber-500/30',

  'bg-blue-50': 'bg-blue-500/10',
  'bg-blue-100': 'bg-blue-500/20',
  'text-blue-700': 'text-blue-400',
  'text-blue-800': 'text-blue-400',
  'border-blue-200': 'border-blue-500/30',

  'bg-red-50': 'bg-red-500/10',
  'bg-red-100': 'bg-red-500/20',
  'bg-red-200': 'bg-red-500/30',
  'text-red-700': 'text-red-400',
  'text-red-800': 'text-red-400',
  'border-red-200': 'border-red-500/30',

  'bg-emerald-50': 'bg-emerald-500/10',
  'bg-emerald-100': 'bg-emerald-500/20',
  'text-emerald-700': 'text-emerald-400',
  'text-emerald-800': 'text-emerald-400',
  'border-emerald-200': 'border-emerald-500/30',

  'bg-purple-50': 'bg-purple-500/10',
  'bg-purple-100': 'bg-purple-500/20',
  'text-purple-700': 'text-purple-400',
  'text-purple-800': 'text-purple-400',
  'border-purple-300': 'border-purple-500/30',

  'bg-indigo-50': 'bg-indigo-500/10',
  'bg-indigo-100': 'bg-indigo-500/20',
  'text-indigo-700': 'text-indigo-400',
  'text-indigo-800': 'text-indigo-400',

  'bg-slate-50': 'bg-surface-300',
  'bg-slate-100': 'bg-surface-300',
  'bg-slate-200': 'bg-surface-200',
  'bg-slate-300': 'bg-surface-200',
  'bg-slate-400': 'bg-surface-100',
  'bg-slate-600': 'bg-surface-100',
  'bg-slate-950': 'bg-surface-500',
  'text-slate-100': 'text-text-primary',
  'border-slate-800': 'border-surface-100',
  'text-gray-300': 'text-text-secondary',
  'bg-gray-800': 'bg-surface-200',
  'bg-gray-700': 'bg-surface-100',
  'border-gray-700': 'border-surface-100',
};

walkDir('./frontend/src/app', function (filePath) {
  if (filePath.endsWith('.html') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    for (const [key, value] of Object.entries(colorMap)) {
      // Replace exact class matches in strings
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      content = content.replace(regex, value);
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  }
});
