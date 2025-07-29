import { google } from 'googleapis';

export default async function handler(req, res) {
  // ✅ CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).send(); // Preflight
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    'contact[first_name]': firstName,
    'contact[last_name]': lastName,
    'contact[phone]': phone,
    'contact[email]': email,
    'contact[garments]': garments,
    'contact[event_info]': eventInfo
  } = req.body;

  // Optional: Get selected date (you'll pass it from frontend)
  const { selectedDate } = req.body;

  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/calendar']
    );

    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary: `Booking: ${firstName} ${lastName}`,
      start: { date: selectedDate }, // All-day event
      end: { date: selectedDate },
      description: `
        Name: ${firstName} ${lastName}
        Phone: ${phone}
        Email: ${email}
        Garments: ${garments || 'Not specified'}
        Event Info: ${eventInfo || 'Not specified'}
      `.trim()
    };

    await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      resource: event
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error creating event:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}