import { google } from 'googleapis';

export default async function handler(req, res) {
  // ✅ Always set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://1ruyb5-ny.myshopify.com'); // ← Specific origin (more secure)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // ✅ Handle preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Content-Length', '0');
    return res.status(200).end();
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
    'contact[event_info]': eventInfo,
    selectedAppointments = []
  } = req.body;

  // ✅ Validate required fields
  if (!firstName || !lastName || !phone || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!selectedAppointments || selectedAppointments.length === 0) {
    return res.status(400).json({ error: 'No appointment selected' });
  }

  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // ← KEY LINE
      ['https://www.googleapis.com/auth/calendar']
    );

    const calendar = google.calendar({ version: 'v3', auth });

    // ✅ Create one event per selected appointment
    for (const appointment of selectedAppointments) {
      // Extract date in "Month DD, YYYY" format
      const dateMatch = appointment.match(/([A-Za-z]+ \d{1,2}, \d{4})/);
      if (!dateMatch) continue;

      const [full, dateStr] = dateMatch;

      // Convert to YYYY-MM-DD
      const jsDate = new Date(dateStr);
      const isoDate = isNaN(jsDate.getTime()) ? null : jsDate.toISOString().split('T')[0];
      if (!isoDate) continue;

      await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        resource: {
          summary: `Booking: ${firstName} ${lastName}`,
          start: { date: isoDate },
          end: { date: isoDate },
          description: `
Name: ${firstName} ${lastName}
Phone: ${phone}
Email: ${email}
Garments: ${garments || 'Not specified'}
Event Info: ${eventInfo || 'Not specified'}
Time: ${appointment.includes('at') ? appointment.split('at')[1].trim() : 'All day'}
          `.trim()
        }
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Google Calendar Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create event' });
  }
}