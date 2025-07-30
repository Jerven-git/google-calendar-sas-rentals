import { google } from 'googleapis';

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/calendar']
);

const calendar = google.calendar({ version: 'v3', auth });

async function testAccess() {
  try {
    const res = await calendar.calendarList.list(); // test reading access
    console.log('✅ Success! Calendars:', res.data.items);
  } catch (err) {
    console.error('❌ Access error:', err.response?.data || err.message);
  }
}

testAccess();
