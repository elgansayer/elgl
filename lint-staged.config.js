module.exports = {
  '*.{js,ts,jsx,tsx,json,md,css,scss,html,yml,yaml}': ['npx prettier --write'],
  '*.{js,ts,jsx,tsx}': ['npx eslint --fix'],
};
