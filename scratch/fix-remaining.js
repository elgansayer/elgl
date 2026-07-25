const fs = require('fs');

const filesToFix = [
  { path: 'frontend/src/app/components/chat-message/chat-message.component.ts', replacements: [[/text-right/g, 'text-end']] },
  { path: 'frontend/src/app/components/chat-search/chat-search.component.ts', replacements: [[/text-left/g, 'text-start']] },
  { path: 'frontend/src/app/components/message-context-menu/message-context-menu.component.ts', replacements: [[/text-left/g, 'text-start']] },
  { path: 'frontend/src/app/components/subscription-plans/subscription-plans.component.ts', replacements: [[/ml-1/g, 'ms-1']] },
  { path: 'frontend/src/app/pages/vip-subscription/vip-subscription.component.html', replacements: [[/ml-2/g, 'ms-2'], [/—/g, '-']] },
];

filesToFix.forEach(f => {
  if (fs.existsSync(f.path)) {
    let content = fs.readFileSync(f.path, 'utf8');
    f.replacements.forEach(([from, to]) => {
      content = content.replace(from, to);
    });
    fs.writeFileSync(f.path, content);
    console.log(`Fixed ${f.path}`);
  } else {
    console.log(`Not found: ${f.path}`);
  }
});
