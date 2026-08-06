# Original HelloTalk Search Screenshot Analysis

Analysis of 49 screenshots from the original HelloTalk Android app
(`/original-hello-talk-screenshots/`), focusing on search-related features.

## Summary

The original HelloTalk app has four distinct search experiences:

1. **Chat-Level Search** (4 screenshots: 012546, 012551, 012559, 012559-1)
2. **Find Partners / Discovery Search** (10 screenshots: 012610, 012624, 012629, 012635, 012646, 012657, 012705)
3. **Custom Search View** (1 screenshot: 012729)
4. **Nearby Map Search** (covered in Find Partners screenshots with map view)

## 1. Chat-Level Search

### Layout
- Search bar at the top of the screen with a magnifying glass icon
- Below the search bar: horizontal scrollable filter tabs

### Filter Tabs Observed
- `All`, `Archives`, `Online`, `Unread`, `My turn`, `Timezone proximity`

### Language Filter Pills
- Horizontal scrollable row of language pills below the filter tabs
- Examples: `Thai`, `English`, `Chinese Simplified`, `Japanese`
- A `More` button at the end for additional languages

### Categories
- `Language Talks` section header
- `AI Assistant` section with suggested prompt cards (e.g. "If they only reply 'ok', are they upset?")

### Result Cards
Each result shows:
- Chat room / conversation name
- Last message preview text
- Timestamp (relative: "Yesterday 23:44", "Monday", "Yesterday 22:34")
- Unread/My turn indicators
- Room type indicators (Live & Voiceroom)

---

## 2. Find Partners / Discovery Search

### Layout
- Page title: `Find Partners`
- Top filter pills in horizontal scroll: `All`, `Serious Learners`, `Nearby`, `City`, `Gender`, `Paid Practice`
- Language filter pills: `Japanese`, `Korean`, `Norwegian` + expand button
- Promotional banner: "Find Your Perfect Chat Partner - Test Now >>"
- Sort options available

### Partner Cards (Rich Layout)
Each partner card shows:

| Element | Example Values |
|---------|---------------|
| Avatar | Profile photo with green "online" dot |
| Name | Display name |
| Language pair | `NO → EN`, `JP → EN`, `NO → JP` |
| Location + distance | `Schaerbeek, Belgium >300km`, `Shenzhen, China`, `Incheon, South Korea` |
| Active status | `Active 2 minutes ago`, `Active now`, `Recently active` |
| Joined date | `Joined 2 days ago`, `Joined 51 days ago` |
| MBTI | `INFP`, `INFJ` |
| Bio preview | Truncated text (2-3 lines) |
| Interest/hobby tags | `BLACKPINK`, `2NE1`, `Games`, `Photography`, `Traveling`, `Baking`, `Diary`, `Video Editing`, `Painting`, `Transformers`, `Spider-Man`, `PUBG` |
| Shared interests | `You both like Fitness` badge |
| Desired interactions | `Correction`, `Pronunciation`, `Language Exchange` |
| Badges | `VIP`, `Partner of Week`, `NEW` |
| Action button | `Connect` |

### Profile Metrics Display
- Follower count, correction ratio, etc. shown on cards (e.g. `1942 0`)

---

## 3. Custom Search

### Layout
- Back navigation: `< Custom Search`
- Filter tabs: `All`, `Serious Learners`
- Compact partner cards (more results visible)

### Compact Card Elements
- Avatar with online indicator
- Name + languages
- Location (compact, inline)
- Active status badge
- Short bio/preview
- `VIP` badge
- `NEW` badge for recently joined users

---

## 4. Nearby / Map Search

### Layout
- Map view showing partner locations
- Pinch-to-zoom world map
- City-based filtering
- Distance indicators on results

---

## Key Design Patterns

### Filter System
- Top-level tabs for major filter categories
- Secondary pill-based filters for languages
- Consistent horizontal scroll pattern for both

### Card Design
- Avatar always left-aligned
- Online status as green dot on avatar
- Language pair prominently displayed
- Location and distance as secondary info
- MBTI shown inline with bio
- Interest tags shown as small rounded pills
- Connect/action button right-aligned or bottom

### Visual Hierarchy
- Primary: Name, language pair
- Secondary: Location, distance, active status
- Tertiary: Bio, interests, MBTI
- Accent: VIP badges, Partner of Week highlight

---

## Current Implementation Gaps

| Feature | Original App | Current Codebase |
|---------|-------------|------------------|
| Chat search filter tabs | All, Archives, Online, Unread, My Turn, Timezone | All, text, voice, correction, doodle, gift |
| Language pills in chat search | Thai, English, Chinese Simplified, Japanese | Not present |
| Find Partners filter tabs | All, Serious, Nearby, City, Gender, Paid Practice | All, Serious, Nearby |
| City filter | Yes | Not in pills |
| Paid Practice filter | Yes | Not present |
| MBTI on cards | Yes | Not present |
| Interest/hobby tags | Yes (on each card) | Not displayed |
| Active status text | Yes ("Active now", "Active 2 min ago") | Green dot only |
| Shared interests badge | Yes ("You both like Fitness") | Not present |
| Custom Search view | Yes (compact layout) | Not present |
| Map/Nearby view | Yes | Basic distance filter only |
