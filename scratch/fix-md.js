const fs = require('fs');

const filesToFix = [
  { path: '.agents/skills/angular-developer/references/pipes.md', replacements: [[/-/g, '-']] },
  {
    path: '.agents/skills/angular-developer/references/signal-forms.md',
    replacements: [[/-/g, '-']],
  },
  { path: '.agents/skills/angular-new-app/SKILL.md', replacements: [[/-/g, '-']] },
];

filesToFix.forEach((f) => {
  if (fs.existsSync(f.path)) {
    let content = fs.readFileSync(f.path, 'utf8');
    f.replacements.forEach(([from, to]) => {
      content = content.replace(from, to);
    });
    fs.writeFileSync(f.path, content);
    console.log(`Fixed ${f.path}`);
  }
});
