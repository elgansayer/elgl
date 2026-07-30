---
Priority: High Impact
Description: Upgrade speech recognition from simple transcription to advanced phonetic feedback. The system must calculate phonetic accuracy (identifying which phonemes were missed or substituted) and provide visual feedback (e.g., highlighting the incorrect sound or syllable) alongside native pronunciation models.
Technical Implementation: Integrate an API gateway that routes audio files to a specialized speech analysis service (e.g., Google Cloud Speech-to-Text with phoneme level analysis) and update the `QuizResponse` model to store detailed phoneme metrics.
---

