export const SEED_ARTICLES = [
  {
    title: 'A Day in London',
    cefr_level: 'A1',
    language: 'en',
    content_text:
      'Today I go to the park. I see a big dog. The dog is brown. I play with my friend. We have a nice time.',
    word_count: 145,
    difficulty_rating: 1,
    tags: ['daily-life', 'city'],
  },
  {
    title: 'La Vida en Madrid',
    cefr_level: 'A2',
    language: 'es',
    content_text:
      'Por la mañana voy al mercado. Compro frutas y verduras frescas. Luego tomo un café con leche en la plaza mayor. Es un día tranquilo y bonito.',
    word_count: 190,
    difficulty_rating: 2,
    tags: ['cultura', 'comida'],
  },
];

export const SEED_DIALOGUES = [
  {
    title: 'Ordering Coffee – Beginner',
    cefr_level: 'A1',
    language: 'en',
    lines: [
      { speaker: 'Barista', text: 'Hello! What can I get for you?' },
      { speaker: 'Customer', text: 'Hi! I would like a coffee, please.' },
      { speaker: 'Barista', text: 'Sure, anything else?' },
      { speaker: 'Customer', text: 'No, thank you. How much is it?' },
      { speaker: 'Barista', text: 'Two pounds fifty.' },
    ],
    tags: ['ordering', 'food'],
  },
  {
    title: 'En la Tienda de Ropa',
    cefr_level: 'A2',
    language: 'es',
    lines: [
      { speaker: 'Vendedor', text: 'Buenos días, ¿puedo ayudarle?' },
      { speaker: 'Cliente', text: 'Sí, busco una camiseta azul.' },
      { speaker: 'Vendedor', text: 'Tenemos esta talla M. ¿Le gusta?' },
      { speaker: 'Cliente', text: 'Sí, me gusta. ¿Cuánto cuesta?' },
      { speaker: 'Vendedor', text: 'Quince euros.' },
    ],
    tags: ['compras', 'ropa'],
  },
];
