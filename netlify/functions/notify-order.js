// netlify/functions/notify-order.js
//
// Triggered by a Netlify Forms "Outgoing webhook" notification (configured
// in the site dashboard, no code change needed to wire it up). Every time
// someone submits the order form, Netlify POSTs the submission here.
//
// This function does two things:
//   1. Sends a clean, branded order-notification email to the business
//      owner via Resend (a transactional email API — see
//      CREDENTIALS-SETUP-GUIDE.md for account setup).
//   2. Optionally fires the Meta Conversions API "Lead" event server-side,
//      de-duplicated against the browser Pixel event using the shared
//      meta_event_id the form already submits. This is what makes the
//      Meta event setup reliable in production instead of Pixel-only,
//      which under-reports on iOS.
//
// No npm install required — everything here uses the fetch() and crypto
// globals already available in Netlify's Node runtime.

const crypto = require('crypto');

function hashSha256(value) {
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

function buildEmailHtml(data, ref, submittedAt) {
  const row = (label, value) => `
    <tr style="border-top:1px solid #eee;">
      <td style="padding:8px 0;color:#666;width:38%;font-size:14px;">${label}</td>
      <td style="padding:8px 0;font-weight:600;font-size:14px;">${value || '—'}</td>
    </tr>`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#14181c;">
    <div style="background:#14181c;padding:20px 24px;border-radius:8px 8px 0 0;">
      <span style="color:#f6b60b;font-weight:700;font-size:20px;letter-spacing:.02em;">SHOPWITH<span style="color:#fff;">FIDOS</span></span>
    </div>
    <div style="border:1px solid #e2e5e8;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <p style="font-size:12px;color:#c98f00;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px;">New order received</p>
      <p style="font-size:20px;font-weight:700;margin:0 0 18px;">Ref: ${ref}</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;width:38%;font-size:14px;">Name</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${(data.firstName || '') + ' ' + (data.lastName || '')}</td></tr>
        ${row('WhatsApp', data.whatsapp)}
        ${row('Address', data.address)}
        ${row('State', data.state)}
        ${row('City / LGA', data.city)}
        ${row('Package', data.package)}
        ${row('Submitted', submittedAt)}
      </table>
      <p style="margin-top:20px;font-size:13px;color:#888;">Confirm with the customer by phone or WhatsApp before dispatch.</p>
    </div>
  </div>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: 'Invalid payload' };
  }

  // Netlify's outgoing form webhook wraps the submitted fields in payload.data
  const data = payload.data || {};
  const ref = 'SWF-' + Date.now().toString().slice(-6);
  const submittedAt = new Date().toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'Shopwithfidos@gmail.com';
  const FROM_EMAIL = process.env.FROM_EMAIL || 'orders@shopwithfidos.online';

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set in Netlify environment variables — email not sent.');
  } else {
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `ShopWithFidos Orders <${FROM_EMAIL}>`,
          to: [ADMIN_EMAIL],
          subject: `New order — ${ref} — ${data.package || 'ShopWithFidos'}`,
          html: buildEmailHtml(data, ref, submittedAt)
        })
      });
      if (!emailRes.ok) {
        console.error('Resend API error:', await emailRes.text());
      }
    } catch (err) {
      console.error('Email send failed:', err);
    }
  }

  // Optional: server-side Meta Conversions API Lead event.
  // Only fires if both env vars are set — safe to leave unset until you're
  // ready to go live with ads.
  const META_PIXEL_ID = process.env.META_PIXEL_ID;
  const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

  if (META_PIXEL_ID && META_ACCESS_TOKEN) {
    try {
      const userData = {};
      if (data.whatsapp) {
        userData.ph = [hashSha256(data.whatsapp.replace(/\D/g, ''))];
      }

      await fetch(
        `https://graph.facebook.com/v20.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: [
              {
                event_name: 'Lead',
                event_time: Math.floor(Date.now() / 1000),
                event_id: data.meta_event_id || undefined, // matches the browser Pixel event so Meta counts one conversion, not two
                action_source: 'website',
                event_source_url: 'https://shopwithfidos.online/',
                user_data: userData,
                custom_data: {
                  content_name: data.package || 'ShopWithFidos order',
                  currency: 'NGN',
                  value: 30000
                }
              }
            ]
          })
        }
      );
    } catch (err) {
      console.error('Meta Conversions API call failed:', err);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, ref })
  };
};
