// netlify/functions/notify-order.js
//

// Triggered by a Netlify Forms "Outgoing webhook" notification.
//
// This function does three things:
//   1. Sends a clean, branded order-notification email to the business
//      owner and support admin via Resend.
//   2. Optionally sends a professional order confirmation to the customer
//      if they provided an email address.
//   3. Optionally fires the Meta Conversions API "Lead" event server-side.

const crypto = require('crypto');

function hashSha256(value) {
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

// HTML Builder for Admin & Support
function buildAdminEmailHtml(data, ref, submittedAt) {
  const row = (label, value) => `
    <tr style="border-top:1px solid #eee;">
      <td style="padding:8px 0;color:#666;width:38%;font-size:14px;">${label}</td>
      <td style="padding:8px 0;font-weight:600;font-size:14px;">${value || '—'}</td>
    </tr>`;

  // Safely grab the name whether the form uses "name" or "firstName"/"lastName"
  const fullName = data.name || ((data.firstName || '') + ' ' + (data.lastName || '')).trim();

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#14181c;">
    <div style="background:#14181c;padding:20px 24px;border-radius:8px 8px 0 0;">
      <span style="color:#f6b60b;font-weight:700;font-size:20px;letter-spacing:.02em;">SHOPWITH<span style="color:#fff;">FIDOS</span></span>
    </div>
    <div style="border:1px solid #e2e5e8;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <p style="font-size:12px;color:#c98f00;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px;">New order received</p>
      <p style="font-size:20px;font-weight:700;margin:0 0 18px;">Ref: ${ref}</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;width:38%;font-size:14px;">Name</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${fullName || '—'}</td></tr>
        ${row('WhatsApp / Phone', data.whatsapp || data.phone)}
        ${row('Email', data.email)}
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

// HTML Builder for the Customer Confirmation
function buildCustomerEmailHtml(data, ref) {
  const customerName = data.name || data.firstName || 'Valued Customer';
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#14181c;line-height:1.6;">
    <h2 style="color:#14181c;border-bottom:2px solid #f6b60b;padding-bottom:10px;">Order Received!</h2>
    <p>Hi ${customerName},</p>
    <p>Thank you for shopping with <strong>ShopWithFidos</strong>! We have successfully received your order for <strong>${data.package || 'our premium product'}</strong> (Order Ref: ${ref}).</p>
    <p>Our team is currently processing your request. We will contact you on WhatsApp or by phone shortly to arrange and confirm your delivery details.</p>
    <p>If you have any immediate questions, feel free to reply directly to this email.</p>
    <p>Best regards,<br><strong>The ShopWithFidos Team</strong></p>
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

  const data = payload.data || {};
  const ref = 'SWF-' + Date.now().toString().slice(-6);
  const submittedAt = new Date().toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  // 1. Email Environment Variables
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'Shopwithfidos@gmail.com';
  const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL; // Optional fallback
  const FROM_EMAIL = process.env.FROM_EMAIL || 'orders@shopwithfidos.online';

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set — email not sent.');
  } else {
    try {
      // Build internal recipients array
      const internalRecipients = [ADMIN_EMAIL];
      if (SUPPORT_EMAIL) internalRecipients.push(SUPPORT_EMAIL);

      // Send 1: Admin & Support Notification
      const adminRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `ShopWithFidos Orders <${FROM_EMAIL}>`,
          to: internalRecipients,
          subject: `New order — ${ref} — ${data.package || 'ShopWithFidos'}`,
          html: buildAdminEmailHtml(data, ref, submittedAt)
        })
      });

      if (!adminRes.ok) console.error('Resend Admin API error:', await adminRes.text());

      // Send 2: Customer Confirmation (Only if email exists in form data)
      if (data.email && data.email.trim() !== '') {
        const customerRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: `ShopWithFidos <${FROM_EMAIL}>`,
            to: [data.email.trim()],
            subject: `Your ShopWithFidos Order Confirmation (#${ref})`,
            html: buildCustomerEmailHtml(data, ref),
            reply_to: ADMIN_EMAIL // Allows customers to hit reply and reach the business directly
          })
        });

        if (!customerRes.ok) console.error('Resend Customer API error:', await customerRes.text());
      }
    } catch (err) {
      console.error('Email send logic failed:', err);
    }
  }

  // 2. Meta Conversions API Logic (Untouched)
  const META_PIXEL_ID = process.env.META_PIXEL_ID;
  const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

  if (META_PIXEL_ID && META_ACCESS_TOKEN) {
    try {
      const userData = {};
      const phoneToHash = data.whatsapp || data.phone;
      if (phoneToHash) {
        userData.ph = [hashSha256(phoneToHash.replace(/\D/g, ''))];
      }
      
      // If customer provided email, hash and send to Meta for better matching
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
                event_id: data.meta_event_id || undefined,
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
        
