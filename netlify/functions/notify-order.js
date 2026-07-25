// netlify/functions/notify-order.js
//
// Triggered by a Netlify Forms "Outgoing webhook" notification (configured
// in the site dashboard — see DOMAIN-AND-RESEND-SETUP-GUIDE.md Part B4).
// Every time someone submits the order form, Netlify POSTs the submission
// here as JSON.
//
// This function sends up to three emails through Resend:
//   1. ADMIN_EMAIL   — the business owner, full order details. Always sent.
//   2. SUPPORT_EMAIL — an internal copy for whoever triages orders. Only
//                       sent if this env var is set; safe to leave unset.
//   3. Customer       — a confirmation email, only sent if the customer
//                       filled in the optional email field on the form.
//
// It also optionally fires the Meta Conversions API "Lead" event
// server-side, de-duplicated against the browser Pixel event using the
// shared meta_event_id the form already submits.
//
// No npm install required — everything here uses the fetch() and crypto
// globals already available in Netlify's Node runtime.
//
// Required environment variables (set in Netlify, never in this file):
//   RESEND_API_KEY   — from resend.com → API Keys
//   FROM_EMAIL        — a verified sending address, e.g. orders@mail.shopwithfidos.online
//   ADMIN_EMAIL       — the business owner's inbox
// Optional:
//   SUPPORT_EMAIL     — a second internal inbox to CC on every order
//   META_PIXEL_ID / META_ACCESS_TOKEN — from the client, once he sends them (see META-SETUP-GUIDE-FOR-CLIENT.md)

const crypto = require('crypto');

function hashSha256(value) {
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function brandHeader() {
  return `<div style="background:#14181c;padding:20px 24px;border-radius:8px 8px 0 0;">
    <span style="color:#f6b60b;font-weight:700;font-size:20px;letter-spacing:.02em;">SHOPWITH<span style="color:#fff;">FIDOS</span></span>
  </div>`;
}

function orderDetailsTable(data, ref, submittedAt) {
  const row = (label, value) => `
    <tr style="border-top:1px solid #eee;">
      <td style="padding:8px 0;color:#666;width:38%;font-size:14px;">${label}</td>
      <td style="padding:8px 0;font-weight:600;font-size:14px;">${escapeHtml(value) || '—'}</td>
    </tr>`;

  return `
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#666;width:38%;font-size:14px;">Name</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${escapeHtml((data.firstName || '') + ' ' + (data.lastName || ''))}</td></tr>
      ${row('WhatsApp', data.whatsapp)}
      ${row('Email', data.email)}
      ${row('Address', data.address)}
      ${row('State', data.state)}
      ${row('City / LGA', data.city)}
      ${row('Package', data.package)}
      ${row('Reference', ref)}
      ${row('Submitted', submittedAt)}
    </table>`;
}

function buildAdminEmailHtml(data, ref, submittedAt) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#14181c;">
    ${brandHeader()}
    <div style="border:1px solid #e2e5e8;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <p style="font-size:12px;color:#c98f00;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px;">New order received</p>
      <p style="font-size:20px;font-weight:700;margin:0 0 18px;">Ref: ${ref}</p>
      ${orderDetailsTable(data, ref, submittedAt)}
      <p style="margin-top:20px;font-size:13px;color:#888;">Confirm with the customer by phone or WhatsApp before dispatch.</p>
    </div>
  </div>`;
}

function buildSupportEmailHtml(data, ref, submittedAt) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#14181c;">
    ${brandHeader()}
    <div style="border:1px solid #e2e5e8;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <p style="font-size:12px;color:#48545f;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px;">Support copy — new order</p>
      <p style="font-size:20px;font-weight:700;margin:0 0 18px;">Ref: ${ref}</p>
      ${orderDetailsTable(data, ref, submittedAt)}
      <p style="margin-top:20px;font-size:13px;color:#888;">This is an internal copy. The admin inbox has already been notified separately.</p>
    </div>
  </div>`;
}

function buildCustomerEmailHtml(data, ref) {
  const firstName = escapeHtml(data.firstName || 'there');
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#14181c;">
    ${brandHeader()}
    <div style="border:1px solid #e2e5e8;border-top:none;padding:28px 24px;border-radius:0 0 8px 8px;">
      <p style="font-size:12px;color:#3fae6a;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin:0 0 10px;">Order received</p>
      <p style="font-size:18px;font-weight:700;margin:0 0 14px;">Thanks, ${firstName}!</p>
      <p style="font-size:15px;line-height:1.6;color:#333;margin:0 0 16px;">
        Your order for the <strong>${escapeHtml(data.package || 'Universal Car Steering Lock')}</strong> has been received.
        We'll call or WhatsApp you at <strong>${escapeHtml(data.whatsapp || 'the number you provided')}</strong> shortly to confirm delivery details.
      </p>
      <div style="font-family:'Courier New',monospace;font-size:14px;color:#c98f00;background:#f7f7f7;border:1px solid #eee;border-radius:6px;padding:10px 16px;display:inline-block;margin-bottom:18px;">
        Ref: ${ref}
      </div>
      <p style="font-size:14px;line-height:1.6;color:#333;margin:0 0 8px;"><strong>Reminder:</strong> this is Pay on Delivery. You pay nothing now, only once the item is in your hands and you've confirmed it's right.</p>
      <p style="font-size:13px;color:#888;margin-top:20px;">Questions before delivery? WhatsApp us anytime at 0803 478 9777.</p>
    </div>
  </div>`;
}

async function sendEmail({ apiKey, from, to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html })
  });
  if (!res.ok) {
    console.error(`Resend API error sending to ${to}:`, await res.text());
  }
  return res.ok;
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

  // Derived from the request itself so no domain is ever hardcoded here.
  // Netlify's form-webhook payload usually includes site_url; if not,
  // fall back to the Host header of the incoming request.
  const siteUrl =
    payload.site_url ||
    (event.headers && event.headers.host ? `https://${event.headers.host}` : undefined);

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL;
  const FROM_EMAIL = process.env.FROM_EMAIL;

  if (!RESEND_API_KEY || !FROM_EMAIL || !ADMIN_EMAIL) {
    console.error(
      'Missing required environment variables (RESEND_API_KEY, FROM_EMAIL, ADMIN_EMAIL) — no emails sent. Set these in Netlify → Project configuration → Environment variables.'
    );
  } else {
    const fromHeader = `ShopWithFidos Orders <${FROM_EMAIL}>`;

    // 1. Admin/client email — always sent
    await sendEmail({
      apiKey: RESEND_API_KEY,
      from: fromHeader,
      to: ADMIN_EMAIL,
      subject: `New order — ${ref} — ${data.package || 'ShopWithFidos'}`,
      html: buildAdminEmailHtml(data, ref, submittedAt)
    }).catch((err) => console.error('Admin email failed:', err));

    // 2. Support/internal copy — only if SUPPORT_EMAIL is configured
    if (SUPPORT_EMAIL) {
      await sendEmail({
        apiKey: RESEND_API_KEY,
        from: fromHeader,
        to: SUPPORT_EMAIL,
        subject: `[Support copy] New order — ${ref}`,
        html: buildSupportEmailHtml(data, ref, submittedAt)
      }).catch((err) => console.error('Support email failed:', err));
    }

    // 3. Customer confirmation — only if the customer filled in the optional email field
    if (data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      await sendEmail({
        apiKey: RESEND_API_KEY,
        from: fromHeader,
        to: data.email,
        subject: `We've got your order — ${ref}`,
        html: buildCustomerEmailHtml(data, ref)
      }).catch((err) => console.error('Customer email failed:', err));
    }
  }

  // Optional: server-side Meta Conversions API Lead event.
  // Only fires once the client has sent both values and they're set as
  // Netlify environment variables — safe to leave unset until then.
  const META_PIXEL_ID = process.env.META_PIXEL_ID;
  const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

  if (META_PIXEL_ID && META_ACCESS_TOKEN) {
    try {
      const userData = {};
      if (data.whatsapp) {
        userData.ph = [hashSha256(data.whatsapp.replace(/\D/g, ''))];
      }
      if (data.email) {
        userData.em = [hashSha256(data.email)];
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
                event_source_url: siteUrl,
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
