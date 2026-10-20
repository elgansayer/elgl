# Pedagogical source review

The application contains reading, chat, corrections, vocabulary review, AI role-play and assessment features. Their presence is an implementation inventory; it does not demonstrate learning effectiveness or integration quality.

This PR adds prompt guidance for comprehensible language, open-ended production, reuse of prior conversation vocabulary and gentle corrective modelling. Concrete scenario tasks and the 1-3 sentence turn limit remain in place. The prompts request these behaviours; model compliance and pedagogical benefit require evaluation.

Test learners at different levels, inspect generated turns, measure recall over time and compare learning outcomes before claiming effectiveness. Reusing a word in dialogue is not itself a spaced-repetition scheduler. Existing vocabulary scheduling, correction-to-card actions and AI conversation context should be tested separately, including explicit user control over saving material.

No claim of best-in-class performance, improved retention or measured learning gains is made by this source review.
