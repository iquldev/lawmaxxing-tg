import { json } from '@sveltejs/kit';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const client = twilio(accountSid, authToken);

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
    const message = await client.messages.create({
      body: `An individual is currently speeding on street "${street}", coordinates: ${coordinates} at ${speed}km/h.`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: process.env.RECEIVER_PHONE_NUMBER!,
    });

    // Update the last message timestamp
    lastMessageTimestamp = currentTime;

    return json({ message: 'SMS sent successfully', response: message });
  } catch (error) {
    console.error('Error sending SMS:', error);
    return json({ error: 'Failed to send SMS' }, { status: 500 });
  }
}
