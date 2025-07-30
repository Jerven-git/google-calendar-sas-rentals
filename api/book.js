import { google } from 'googleapis';

export default async function handler(req, res) {
  // ✅ Manually parse JSON body if not already parsed
  if (!req.body) {
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }

    try {
      req.body = JSON.parse(Buffer.concat(buffers).toString());
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  // ✅ CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://1ruyb5-ny.myshopify.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✅ Extract CAPTCHA token
  const token = req.body['captcha_token'];
  if (!token) {
    return res.status(400).json({ error: 'Missing CAPTCHA token' });
  }

  // ✅ Verify CAPTCHA token
  try {
    const captchaVerifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`
    });

    const captchaData = await captchaVerifyRes.json();

    if (!captchaData.success || captchaData.score < 0.5) {
      return res.status(400).json({ error: 'Failed CAPTCHA verification' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'CAPTCHA verification failed', message: err.message });
  }

  // ✅ Extract form data
  const {
    'contact[first_name]': firstName,
    'contact[last_name]': lastName,
    'contact[phone]': phone,
    'contact[email]': email,
    'contact[garments]': garments,
    'contact[event_info]': eventInfo,
    selectedAppointments = []
  } = req.body;

  if (!firstName || !lastName || !phone || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!selectedAppointments.length) {
    return res.status(400).json({ error: 'No appointment selected' });
  }

  try {
    // ✅ Authenticate with Google Calendar API
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/calendar']
    );

    const calendar = google.calendar({ version: 'v3', auth });

    // ✅ Create calendar events
    for (const appointment of selectedAppointments) {
      const jsDate = new Date(appointment);
      if (isNaN(jsDate.getTime())) {
        console.warn('[WARNING] Invalid date format:', appointment);
        continue;
      }

      const startDateTime = jsDate.toISOString();
      const endDateTime = new Date(jsDate.getTime() + 60 * 60 * 1000).toISOString();

      await calendar.events.insert({
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
    return res.status(500).json({
      success: false,
      error: 'Function crashed',
      message: err.message
    });
  }
}