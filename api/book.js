import { google } from 'googleapis';

export default async function handler(req, res) {
  // ✅ Always set CORS headers FIRST
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://1ruyb5-ny.myshopify.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // ✅ Immediately handle OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // CORS preflight success
  }

  // ✅ Only parse body for POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✅ Handle raw body parse (required for Vercel)
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

  console.log('[DEBUG] Request Body:', req.body);
  console.log('[DEBUG] captcha_token:', req.body.captcha_token);

  // reCAPTCHA verification
  const captchaToken = req.body.captcha_token;
  if (!captchaToken) {
    return res.status(400).json({ error: 'Captcha token missing' });
  }

  const verifyCaptcha = async (token) => {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token
      }).toString()
    });

    return await response.json();
  };

  const captchaResult = await verifyCaptcha(captchaToken);
  console.log('[DEBUG] CAPTCHA RESULT', captchaResult);

  // Temporary for debug only
  if (!captchaResult.success) {
    return res.status(403).json({
      error: 'Captcha verification failed',
      raw: captchaResult
    });
  }

  if (!captchaResult.success || captchaResult.score < 0.1) {
    return res.status(403).json({ error: 'Captcha verification failed', score: captchaResult.score });
  }

  // Parse form data
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

  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/calendar']
    );
    console.log('[DEBUG] EMAIL:', process.env.GOOGLE_CLIENT_EMAIL);
    console.log('[DEBUG] CALENDAR ID:', process.env.GOOGLE_CALENDAR_ID);
    const calendar = google.calendar({ version: 'v3', auth });

    for (const appointment of selectedAppointments) {
      const jsDate = new Date(appointment); // Be sure format is parsable
      if (isNaN(jsDate.getTime())) {
        console.warn('[WARNING] Invalid appointment format:', appointment);
        continue;
      }

      const startDateTime = jsDate.toISOString();
      const endDateTime = new Date(jsDate.getTime() + 60 * 60 * 1000).toISOString(); // +1 hour

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
    return res.status(500).json({ success: false, error: 'Function crashed', message: err.message });
  }
}
