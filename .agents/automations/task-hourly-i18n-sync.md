# Hourly I18n String Sync

## Objective
Guarantee zero hardcoded UI strings are ever merged into `main`.

## Instructions
1. Scan all modified Angular templates (`*.html`) and components (`*.ts`) over the last hour.
2. Extract any newly added English strings and replace them with the `TranslatePipe` or `I18nService`.
3. Add the extracted keys to the English localization dictionary file.
4. Mock translating them for Arabic/Spanish in the mock dictionaries to verify the layout handles varying text lengths.
