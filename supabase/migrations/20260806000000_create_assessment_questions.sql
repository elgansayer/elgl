CREATE TABLE IF NOT EXISTS public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_text TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    options JSONB NOT NULL,
    correct_option_id TEXT NOT NULL,
    skill_area TEXT NOT NULL DEFAULT 'general',
    category TEXT NOT NULL DEFAULT 'self_assessment',
    difficulty_level INTEGER NOT NULL DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assessment_questions_language_idx
    ON public.assessment_questions (language, difficulty_level);

-- Seed 10 questions matching the diagnostic quiz skill coverage (speaking, listening, reading, writing, grammar, vocabulary)
INSERT INTO public.assessment_questions (id, question_text, language, options, correct_option_id, skill_area, category, difficulty_level) VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    'How well can you introduce yourself and answer basic questions about your personal details (name, age, where you live)?',
    'en',
    '[
        {"id": "q1_a", "text": "I struggle to understand or reply, even with help.", "points": 1},
        {"id": "q1_b", "text": "I can manage with simple, memorised phrases if the other person speaks slowly and clearly.", "points": 2},
        {"id": "q1_c", "text": "I can introduce myself and answer basic questions with some hesitation.", "points": 3},
        {"id": "q1_d", "text": "I can do this easily, confidently, and naturally.", "points": 4}
    ]'::jsonb,
    'q1_d',
    'speaking',
    'self_assessment',
    1
),
(
    'a0000000-0000-0000-0000-000000000002',
    'Can you understand the main points of clear, standard speech on familiar matters (work, school, leisure, travel)?',
    'en',
    '[
        {"id": "q2_a", "text": "No, I need translations or subtitles for nearly everything.", "points": 1},
        {"id": "q2_b", "text": "I can catch a few familiar words and phrases but often lose the thread.", "points": 2},
        {"id": "q2_c", "text": "Yes, I understand the main ideas when the topic is familiar and the speaker is clear.", "points": 3},
        {"id": "q2_d", "text": "Yes, I understand almost everything, including nuanced discussions and different accents.", "points": 4}
    ]'::jsonb,
    'q2_d',
    'listening',
    'comprehension',
    2
),
(
    'a0000000-0000-0000-0000-000000000003',
    'How comfortable are you expressing opinions, giving reasons, and explaining plans or ambitions?',
    'en',
    '[
        {"id": "q3_a", "text": "I cannot do this yet -- I mostly rely on single words or gestures.", "points": 1},
        {"id": "q3_b", "text": "I can state my opinion in simple terms using basic connectors (and, but, because).", "points": 2},
        {"id": "q3_c", "text": "I can give clear reasons and explanations with reasonable fluency on familiar topics.", "points": 3},
        {"id": "q3_d", "text": "I can express myself fluently and spontaneously, structuring arguments precisely.", "points": 4}
    ]'::jsonb,
    'q3_d',
    'speaking',
    'production',
    3
),
(
    'a0000000-0000-0000-0000-000000000004',
    'How well can you read and understand articles, reports, or stories in the target language?',
    'en',
    '[
        {"id": "q4_a", "text": "I can only recognise a few words and very short, simple sentences.", "points": 1},
        {"id": "q4_b", "text": "I can understand short, simple texts on familiar topics with occasional look-ups.", "points": 2},
        {"id": "q4_c", "text": "I can read articles and reports on current affairs and grasp the author''s viewpoint.", "points": 3},
        {"id": "q4_d", "text": "I can read with ease virtually all forms of written language, including abstract and literary texts.", "points": 4}
    ]'::jsonb,
    'q4_d',
    'reading',
    'comprehension',
    3
),
(
    'a0000000-0000-0000-0000-000000000005',
    'How well can you write texts such as messages, emails, essays, or reports?',
    'en',
    '[
        {"id": "q5_a", "text": "I can write a few isolated words and very simple phrases (e.g. greetings, filling in forms).", "points": 1},
        {"id": "q5_b", "text": "I can write short, simple notes and messages on familiar everyday topics.", "points": 2},
        {"id": "q5_c", "text": "I can write clear, detailed text on a range of subjects and explain viewpoints.", "points": 3},
        {"id": "q5_d", "text": "I can write complex texts in an appropriate and effective style, with logical structure.", "points": 4}
    ]'::jsonb,
    'q5_d',
    'writing',
    'production',
    4
),
(
    'a0000000-0000-0000-0000-000000000006',
    'In a conversation, how well can you interact and keep the dialogue going?',
    'en',
    '[
        {"id": "q6_a", "text": "I can only respond with single words or rehearsed phrases.", "points": 1},
        {"id": "q6_b", "text": "I can handle very short social exchanges but cannot sustain a conversation on my own.", "points": 2},
        {"id": "q6_c", "text": "I can enter unprepared into conversations on familiar topics and handle everyday situations.", "points": 3},
        {"id": "q6_d", "text": "I can interact with ease and spontaneity, taking turns naturally and repairing communication smoothly.", "points": 4}
    ]'::jsonb,
    'q6_d',
    'speaking',
    'interaction',
    5
),
(
    'a0000000-0000-0000-0000-000000000007',
    'How well do you handle grammar -- verb tenses, sentence structure, articles, prepositions?',
    'en',
    '[
        {"id": "q7_a", "text": "I make frequent basic errors that often cause misunderstanding.", "points": 1},
        {"id": "q7_b", "text": "I use simple structures correctly but still make noticeable errors with complex sentences.", "points": 2},
        {"id": "q7_c", "text": "I have good grammatical control with occasional errors that do not cause misunderstanding.", "points": 3},
        {"id": "q7_d", "text": "I maintain a high degree of grammatical accuracy; errors are rare and difficult to spot.", "points": 4}
    ]'::jsonb,
    'q7_d',
    'grammar',
    'self_assessment',
    2
),
(
    'a0000000-0000-0000-0000-000000000008',
    'How would you rate your vocabulary range -- can you find the right words for different situations?',
    'en',
    '[
        {"id": "q8_a", "text": "I have a very limited vocabulary restricted to immediate personal needs.", "points": 1},
        {"id": "q8_b", "text": "I have enough vocabulary for everyday transactions and familiar topics, but often search for words.", "points": 2},
        {"id": "q8_c", "text": "I have a good range of vocabulary for most topics and can paraphrase when I lack a specific word.", "points": 3},
        {"id": "q8_d", "text": "I have a rich and precise vocabulary, including idiomatic expressions and colloquialisms.", "points": 4}
    ]'::jsonb,
    'q8_d',
    'vocabulary',
    'self_assessment',
    2
),
(
    'a0000000-0000-0000-0000-000000000009',
    'How well can you understand films, TV programmes, podcasts, or radio without subtitles or transcripts?',
    'en',
    '[
        {"id": "q9_a", "text": "I can barely follow anything without visual aids or translations.", "points": 1},
        {"id": "q9_b", "text": "I can follow the general storyline when the delivery is slow and clear.", "points": 2},
        {"id": "q9_c", "text": "I can understand most TV news and current affairs programmes, and the majority of films in standard dialect.", "points": 3},
        {"id": "q9_d", "text": "I have no difficulty understanding any kind of spoken language, whether live or broadcast, even at fast native speed.", "points": 4}
    ]'::jsonb,
    'q9_d',
    'listening',
    'comprehension',
    4
),
(
    'a0000000-0000-0000-0000-000000000010',
    'How easily can you recognise implied meaning, humour, sarcasm, and cultural references?',
    'en',
    '[
        {"id": "q10_a", "text": "I take everything literally and often miss non-literal meanings entirely.", "points": 1},
        {"id": "q10_b", "text": "I can sometimes detect tone (angry, happy) but miss subtle implications.", "points": 2},
        {"id": "q10_c", "text": "I can usually recognise irony, humour, and cultural cues in familiar contexts.", "points": 3},
        {"id": "q10_d", "text": "I appreciate fine shades of meaning, wordplay, and culture-specific references with ease.", "points": 4}
    ]'::jsonb,
    'q10_d',
    'listening',
    'interaction',
    5
);