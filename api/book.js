import { google } from 'googleapis';

export default async function handler(req, res) {
  // ✅ CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ✅ Handle preflight (OPTIONS) request
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }

  // ✅ Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { date, FirstName, LastName, email, phone, garments, eventInfo } = req.body;

  try {
    // ✅ Authenticate with Google Calendar
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/calendar']
    );

    const calendar = google.calendar({ version: 'v3', auth });

    // ✅ Create event
    await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      resource: {
        summary: `Booking: ${FirstName} ${LastName}`,
        start: { date },
        end: { date },
        description: `
          Name: ${FirstName} ${LastName}
          Email: ${email}
          Phone: ${phone}
          Garments: ${garments}
          Event Info: ${eventInfo}
        `.trim()
      }
    });

    // ✅ Success
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error creating event:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}