import { google } from 'googleapis';

export default async function handler(req, res) {
  // ✅ CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).send();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    'contact[first_name]': firstName,
    'contact[last_name]': lastName,
    'contact[phone]': phone,
    'contact[email]': email,
    'contact[garments]': garments,
    'contact[event_info]': eventInfo,
    selectedAppointments = []
  } = req.body;

  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/calendar']
    );

    const calendar = google.calendar({ version: 'v3', auth });

    // ✅ Create an event for each selected appointment
    const promises = selectedAppointments.map(async (appointmentText) => {
      // Extract date from string like "April 5, 2025 at 10:00 AM"
      const dateMatch = appointmentText.match(/([A-Za-z]+ \d{1,2}, \d{4})/);
      const timeMatch = appointmentText.match(/\d{1,2}:\d{2} [APMapm]+/);

      const dateStr = dateMatch ? dateMatch[0] : null;
      const timeStr = timeMatch ? timeMatch[0] : null;

      // Convert to YYYY-MM-DD
      const jsDate = new Date(dateStr);
      const isoDate = isNaN(jsDate.getTime()) ? null : jsDate.toISOString().split('T')[0];

      if (!isoDate) {
        console.warn('Invalid date:', appointmentText);
        return;
      }

      await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        resource: {
          summary: `Booking: ${firstName} ${lastName}`,
          start: { date: isoDate }, // All-day event
          end: { date: isoDate },
          description: `
            Name: ${firstName} ${lastName}
            Phone: ${phone}
            Email: ${email}
            Garments: ${garments || 'Not specified'}
            Event Info: ${eventInfo || 'Not specified'}
            Time: ${timeStr || 'All day'}
          `.trim()
        }
      });
    });

    await Promise.all(promises);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}