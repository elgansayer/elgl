# Dynamic Category Selection for Report Dialog

## Overview

The report modal in the Trust and Safety flow must allow users to choose from a dynamic set of categories, tailored to the context (reported user's language pair, report type, etc.). This design ensures the category list is not hardcoded and can be adapted without frontend redeployment.

## Category Source

- A dedicated backend endpoint: `GET /api/reports/categories?reportedUserId=<uuid>`.
- The backend can compute available categories based on:
  - The reported user's native language and target languages (from `users` table).
  - Global default categories (e.g., "Spam", "Harassment", "Inappropriate Content").
  - The reporting user's language preferences for translated labels.

## Category Structure

- Flat list of objects:
  ```json
  {
    "categoryId": "string (e.g., 'spam', 'harassment', 'profile_fake')",
    "label": "Localized display string (e.g. 'Spam / تبلیغات')"
  }
  ```
- Categories are not hierarchical; subcategories are represented as separate entries when needed.
- The `reason_category` field in the `reports` table remains a simple `Text` (string) storing the selected `categoryId`.

## Trigger for Loading

- The report modal (`ReportDialogComponent`) calls the endpoint when it opens.
- If the reported user changes (e.g., navigating to a different profile), the modal re-fetches.
- On fetch failure, fallback to a minimal static list ([{categoryId: 'other', label: 'Other'}]).

## Backward Compatibility

- Existing reports with hardcoded category strings remain valid.
- New reports will store the `categoryId` string from the dynamic list.
- Backend DTO: `CreateReportDto` must include `reportedUserId` and `reasonCategory` (string). The validation may allow only values present in the response for that user.

## UI/UX Requirements

- The category list should appear as a picker (radio buttons or dropdown) with clear labels.
- RTL support: labels must respect the user's locale direction.
- A loading skeleton should be shown while categories are fetched.
- Once a category is selected, the submit button becomes enabled.

## API Contract Example

```
GET /api/reports/categories?reportedUserId=abc-123&locale=ar
Response:
[
  { "categoryId": "spam", "label": "بريد مزعج" },
  { "categoryId": "harassment", "label": "مضايقة" },
  { "categoryId": "profile_fake", "label": "ملف تعريف مزيف" }
]
```
