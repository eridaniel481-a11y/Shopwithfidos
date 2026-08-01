// netlify/functions/public-config.js
//
// Returns a small JSON object of values that are safe to expose to the
// browser — the Meta Pixel ID and the conversion event name. This is what lets
// steering-lock/index.html and thank-you.html load the real Pixel ID
// without it ever being hardcoded in the HTML/JS that ships to visitors.
//
// Update the Pixel ID or the event name at any time by setting META_PIXEL_ID
// / META_EVENT_NAME in Netlify →
// Project configuration → Environment variables, then redeploying (or
// waiting for the next cold start — no code change needed).
//
// IMPORTANT: only ever add NON-SECRET values here. META_ACCESS_TOKEN (the
// Conversions API token) must never be exposed through this endpoint —
// it stays server-side only, inside notify-order.js.

// The conversion event name is config-driven: set META_EVENT_NAME in Netlify
// to change what the Pixel and the Conversions API report (e.g. Purchase,
// Lead, CompleteRegistration). If it is missing, empty or whitespace-only,
// it falls back to 'Purchase' — the site is pay on delivery, so a completed
// order submission is treated as a sale.
const DEFAULT_META_EVENT_NAME = 'Purchase';

exports.handler = async () => {
  const pixelId = process.env.META_PIXEL_ID || null;
  const eventName =
    (process.env.META_EVENT_NAME || '').trim() || DEFAULT_META_EVENT_NAME;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // 5 min — short enough that a new Pixel ID shows up quickly
    },
    body: JSON.stringify({ pixelId, eventName })
  };
};
