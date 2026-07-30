# .tasks/001-room-taxonomy-schema.md

## Title: Voiceroom Taxonomy & Organisation Schema
**Description:** Implement the database schema and NestJS backend updates required to categorise live audio and video rooms.

**Checklist:**
- [ ] Create Supabase migration to add `room_categories` and `room_tags` tables.
- [ ] Update `audio_rooms` table to include foreign keys for category and an array of tags (e.g., "Casual Chat", "Grammar Help").
- [ ] Add `target_cefr_level` (A1 to C2) and `max_participants` columns to the `audio_rooms` table.
- [ ] Update NestJS `AudioRoomsService` to support querying and filtering by these new taxonomies.
- [ ] Write Jest unit tests for the updated PostGIS and taxonomy queries.
