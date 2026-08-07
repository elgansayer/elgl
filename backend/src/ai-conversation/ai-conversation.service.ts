import { Injectable } from '@nestjs/common';

export interface Scenario {
  id: string;
  name: string;
}

@Injectable()
export class AiConversationService {
  private readonly scenarios: Scenario[] = [
    { id: 'ordering-coffee', name: 'Ordering Coffee' },
    { id: 'job-interview', name: 'Job Interview' },
    { id: 'hotel-booking', name: 'Hotel Booking' },
    { id: 'doctor-appointment', name: 'Doctor Appointment' },
    { id: 'restaurant-order', name: 'Restaurant Order' },
    { id: 'airport-checkin', name: 'Airport Check-in' },
    { id: 'bank-account', name: 'Opening a Bank Account' },
    { id: 'shopping', name: 'Shopping for Clothes' },
    { id: 'travel-directions', name: 'Asking for Directions' },
    { id: 'small-talk', name: 'Small Talk with a Stranger' },
  ];

  getScenarios(): Scenario[] {
    return this.scenarios;
  }

  generateReply(userMessage: string, scenarioId?: string): string {
    const scenarioReplies: Record<string, string[]> = {
      'ordering-coffee': [
        'Would you like a latte, cappuccino, or something else?',
        'What size would you like? Small, medium, or large?',
        'Would you like any extras? A shot of vanilla syrup?',
        'Great choice, I will prepare that for you right away!',
        'That comes to £3.50 / $4.50. Will that be card or cash?',
      ],
      'job-interview': [
        'Tell me a little about yourself.',
        'What are your greatest strengths?',
        'Why do you want to work here?',
        'Where do you see yourself in five years?',
        'Thank you for your answers. We will be in touch soon.',
      ],
      'hotel-booking': [
        'How many nights will you be staying?',
        'Would you prefer a single or double room?',
        'We have a view of the city or the sea. Which do you prefer?',
        'Breakfast is included. Check out is at 11 am.',
        'Your reservation is confirmed! Thank you for choosing our hotel.',
      ],
      'doctor-appointment': [
        'What symptoms are you experiencing?',
        'How long have you been feeling this way?',
        'Are you on any medication?',
        'I’d like to take your temperature and blood pressure.',
        'I recommend rest and plenty of fluids. Come back if symptoms worsen.',
      ],
      'restaurant-order': [
        'Good evening, would you like to see the menu?',
        'Today’s special is grilled salmon with vegetables.',
        'How would you like your steak? Rare, medium, or well done?',
        'Can I get you any drinks?',
        'Would you like dessert? We have chocolate cake and cheesecake.',
      ],
      'airport-checkin': [
        'Can I see your passport, please?',
        'Do you have any luggage to check in?',
        'Here is your boarding pass. Gate B12. Boarding starts at 2:30.',
        'Would you like a window or an aisle seat?',
        'Have a pleasant flight!',
      ],
      'bank-account': [
        'What type of account would you like to open? (savings or checking)',
        'Please provide a valid ID and proof of address.',
        'We need your signature here.',
        'There is a minimum deposit of £50 / $65.',
        'Your account is now active. Here are your details.',
      ],
      shopping: [
        'Welcome to our store! Can I help you find anything?',
        'What size are you looking for?',
        'This colour is very popular this season.',
        'We have a buy-one-get-one-free offer on selected items.',
        'These are £25 / $32. Would you like to try them on?',
      ],
      'travel-directions': [
        'Excuse me, do you know where the nearest train station is?',
        'Sure, turn left at the next traffic light and go straight.',
        'It is about a 10-minute walk from here.',
        'You can also take bus number 12. It stops right outside.',
        'You’re welcome! Enjoy your trip!',
      ],
      'small-talk': [
        'Hi there! Lovely weather today, isn’t it?',
        'How are you doing? What brings you here?',
        'Do you come to this area often?',
        'That’s interesting! I’ve never heard that before.',
        'It was nice chatting with you. Take care!',
      ],
    };

    const replies =
      scenarioId && scenarioReplies[scenarioId]
        ? scenarioReplies[scenarioId]
        : [
            'That is fascinating! Can you tell me more about it?',
            'I see. How does that make you feel?',
            'Ah, I understand. What else have you been learning?',
            'Interesting point. Do you have an example?',
            'I appreciate your perspective. Could you elaborate?',
            'Great question! Let me think...',
            'I agree. Have you tried any new language techniques recently?',
            'That reminds me of something I read. Keep going!',
            'Nice! You are making excellent progress.',
            'Hmm, let me reflect on that.',
          ];
    const index = userMessage.length % replies.length;
    return replies[index];
  }
}
