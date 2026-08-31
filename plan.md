1. Modify `LearnerKnowledgeService.getProfile` to fall back to a validated CEFR default (`A1`) if the `userProfile.proficiency_level` is not valid CEFR. Wait, the prompt says "a learner can therefore receive the same arbitrary string as their Spanish, French, etc. proficiency. Please source proficiency from language-scoped assessment data (the already-fetched assessments value is still unused), or explicitly fall back to a validated CEFR default until such data exists."
Since `assessments` is unused, we can just explicitly fall back to `A1`.
To satisfy "or explicitly fall back to a validated CEFR default until such data exists" and "Add a multi-language and invalid-value regression test".
Let's implement a valid CEFR check:
`const validCEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']`
`const baseLevel = validCEFR.includes(userProfile?.proficiency_level) ? userProfile.proficiency_level : 'A1';`
Wait, does it mean if they are learning two languages, their `userProfile.proficiency_level` shouldn't be used for both if it's not scoped? Yes, the comment says: "getProfile(userId, language) now returns users.proficiency_level for every requested language, while UserProfile supports multiple target_languages and the stored proficiency value is not language-scoped or validated as a CEFR level. A learner can therefore receive the same arbitrary string as their Spanish, French, etc. proficiency... explicitly fall back to a validated CEFR default until such data exists."
So I should just NOT use `userProfile.proficiency_level` at all because it's not language scoped! The instruction explicitly says "Please source proficiency from language-scoped assessment data... or explicitly fall back to a validated CEFR default until such data exists."
So I will just change it to:
```typescript
const baseLevel = 'A1'; // Fallback until language-scoped assessment data exists
```
And remove `assessments` if it's unused, as the comment says "either use or remove the fetched `assessments` value". I will just remove the fetching of `assessments` entirely since there's no language-scoped user assessment data endpoint that is being mocked right now. (Wait, let me just check what `assessments` is actually returning).
