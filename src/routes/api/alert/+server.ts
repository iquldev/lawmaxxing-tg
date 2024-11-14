import { json } from '@sveltejs/kit';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Telegran Bot
const telegramToken = process.env.TELEGRAM_API_TOKEN!;
const telegramId = process.env.TELEGRAM_USER_ID!;

// In-memory storage for the last sent message timestamp
let lastMessageTimestamp: number | null = null;
const ONE_MINUTE = 10 * 1000; // 10 sec in milliseconds

export async function POST({ request }) {
  const { street, coordinates, speed } = await request.json();

  const currentTime = Date.now();

  // Check if 1 minute has passed since the last message
  if (lastMessageTimestamp && currentTime - lastMessageTimestamp < ONE_MINUTE) {
    return json({ error: 'You must wait 1 minute between SMS messages' }, { status: 429 });
  }

  try {
    const message = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: telegramId,
        text: `An individual is currently speeding on street "${street}", coordinates: ${coordinates} at ${speed}km/h.`,
      }),
    });

    // Update the last message timestamp
    lastMessageTimestamp = currentTime;

    return json({ message: 'SMS sent successfully', response: message });
  } catch (error) {
    console.error('Error sending SMS:', error);
    return json({ error: 'Failed to send SMS' }, { status: 500 });
  }
}
