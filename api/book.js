import { google } from 'googleapis';

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', 'https://1ruyb5-ny.myshopify.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.setHeader('Content-Length', '0');
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('[DEBUG] Raw Body:', req.body);

    const {
      'contact[first_name]': firstName,
      'contact[last_name]': lastName,
      'contact[phone]': phone,
      'contact[email]': email,
      'contact[garments]': garments,
      'contact[event_info]': eventInfo,
      selectedAppointments = []
    } = req.body || {};

    if (!firstName || !lastName || !phone || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!selectedAppointments.length) {
      return res.status(400).json({ error: 'No appointment selected' });
    }

    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/calendar']
    );

    console.log('[DEBUG] Authenticating with:', process.env.GOOGLE_CLIENT_EMAIL);

    const calendar = google.calendar({ version: 'v3', auth });

    for (const appointment of selectedAppointments) {
      const dateMatch = appointment.match(/([A-Za-z]+ \d{1,2}, \d{4})/);
      if (!dateMatch) continue;

      const [, dateStr] = dateMatch;
      const jsDate = new Date(appointment); // Full "July 30, 2025 at 2:00 PM"
      const startDateTime = jsDate.toISOString();
      const endDateTime = new Date(jsDate.getTime() + 60 * 60 * 1000).toISOString(); // 1-hour duration


      if (!isoDate) {
        console.warn('[WARNING] Invalid date:', dateStr);
        continue;
      }

      calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        resource: {
          summary: `Booking: ${firstName} ${lastName}`,
          start: { dateTime: startDateTime, timeZone: 'Asia/Manila' },
          end: { dateTime: endDateTime, timeZone: 'Asia/Manila' },
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
  } catch (err) {
    console.error('[ERROR]', err);
    return res.status(500).json({ success: false, error: 'Function crashed', message: err.message });
  }
}
