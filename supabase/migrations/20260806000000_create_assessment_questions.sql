CREATE TABLE IF NOT EXISTS public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_text TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    options JSONB NOT NULL,
    correct_option_id TEXT NOT NULL,
    skill_area TEXT NOT NULL DEFAULT 'general',
    difficulty_level INTEGER NOT NULL DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assessment_questions_language_idx
    ON public.assessment_questions (language, difficulty_level);

-- Seed questions
INSERT INTO public.assessment_questions (id, question_text, language, options, correct_option_id, skill_area, difficulty_level) VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    'How well can you introduce yourself and answer basic questions about your personal details?',
    'en',
    '[
        {"id": "o1", "text": "I struggle to understand and reply.", "points": 1},
        {"id": "o2", "text": "I can do it with simple phrases if the other person speaks slowly.", "points": 2},
        {"id": "o3", "text": "I can do it easily and confidently.", "points": 3}
    ]'::jsonb,
    'o3',
    'speaking',
    1
),
(
    'a0000000-0000-0000-0000-000000000002',
    'Can you understand the main points of clear standard input on familiar matters regularly encountered in work, school, leisure, etc.?',
    'en',
    '[
        {"id": "o1", "text": "No, I need translation for most things.", "points": 1},
        {"id": "o2", "text": "Yes, if the topic is very familiar to me.", "points": 2},
        {"id": "o3", "text": "Yes, I understand almost everything clearly.", "points": 3}
    ]'::jsonb,
    'o3',
    'listening',
    2
),
(
    'a0000000-0000-0000-0000-000000000003',
    'How comfortable are you expressing your opinions and providing explanations for your plans?',
    'en',
    '[
        {"id": "o1", "text": "I cannot do this yet.", "points": 1},
        {"id": "o2", "text": "I can give brief reasons and explanations.", "points": 2},
        {"id": "o3", "text": "I can express myself fluently and spontaneously.", "points": 3}
    ]'::jsonb,
    'o3',
    'speaking',
    3
),
(
    'a0000000-0000-0000-0000-000000000004',
    'How well can you read and understand articles and reports concerned with contemporary problems?',
    'en',
    '[
        {"id": "o1", "text": "I can only understand very short, simple texts.", "points": 1},
        {"id": "o2", "text": "I can understand texts that consist mainly of high-frequency everyday language.", "points": 2},
        {"id": "o3", "text": "I can understand long and complex factual and literary texts.", "points": 3}
    ]'::jsonb,
    'o3',
    'reading',
    3
),
(
    'a0000000-0000-0000-0000-000000000005',
    'How well can you write clear, well-structured text on complex subjects?',
    'en',
    '[
        {"id": "o1", "text": "I can write simple isolated phrases and sentences.", "points": 1},
        {"id": "o2", "text": "I can write simple connected text on familiar topics.", "points": 2},
        {"id": "o3", "text": "I can write clear, detailed text on a wide range of subjects.", "points": 3}
    ]'::jsonb,
    'o3',
    'writing',
    4
),
(
    'a0000000-0000-0000-0000-000000000006',
    'Can you interact with a degree of fluency and spontaneity that makes regular interaction with native speakers possible?',
    'en',
    '[
        {"id": "o1", "text": "I can only interact in a simple way if the other person is prepared to repeat or rephrase.", "points": 1},
        {"id": "o2", "text": "I can handle short social exchanges but cannot keep the conversation going.", "points": 2},
        {"id": "o3", "text": "I can interact with native speakers without strain for either party.", "points": 3}
    ]'::jsonb,
    'o3',
    'speaking',
    5
),
(
    'a0000000-0000-0000-0000-000000000007',
    'Can you understand the main ideas of complex text on both concrete and abstract topics?',
    'en',
    '[
        {"id": "o1", "text": "No, I struggle with anything beyond basic phrases.", "points": 1},
        {"id": "o2", "text": "I can understand the main points when the text is clearly organised.", "points": 2},
        {"id": "o3", "text": "I can understand complex texts and recognise implicit meaning.", "points": 3}
    ]'::jsonb,
    'o3',
    'reading',
    5
),
(
    'a0000000-0000-0000-0000-000000000008',
    'How well can you handle most situations likely to arise while travelling in an area where the language is spoken?',
    'en',
    '[
        {"id": "o1", "text": "I would struggle to communicate basic needs.", "points": 1},
        {"id": "o2", "text": "I can handle common travel situations with some preparation.", "points": 2},
        {"id": "o3", "text": "I can handle most situations with ease and adapt spontaneously.", "points": 3}
    ]'::jsonb,
    'o3',
    'speaking',
    2
);