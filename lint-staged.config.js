module.exports = {
  '*.{js,ts,jsx,tsx,json,md,css,scss,html,yml,yaml}': ['prettier --write'],
  '*.{js,ts,jsx,tsx}': ['eslint --fix'],
};
