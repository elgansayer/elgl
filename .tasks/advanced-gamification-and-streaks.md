---
Priority: High Impact
Description: Enhance the gamification layer beyond basic point accumulation. Implement daily streak counters, loss mechanics (e.g., "dormancy penalty" or "streak freeze" purchasable items), and a structured XP/Level system linked directly to curriculum completion (e.g., "JLPT N4 Tier").
Technical Implementation: Update the `User` model to include `streak_days`, `xp_level`, and integrate a nightly cron job or background worker to calculate and award XP upon completion of goals.
---

