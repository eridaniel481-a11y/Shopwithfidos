// netlify/functions/public-config.js
//
// Returns a small JSON object of values that are safe to expose to the
// browser — currently just the Meta Pixel ID. This is what lets
// steering-lock/index.html and thank-you.html load the real Pixel ID
// without it ever being hardcoded in the HTML/JS that ships to visitors.
//
// Update the Pixel ID at any time by setting META_PIXEL_ID in Netlify →
// Project configuration → Environment variables, then redeploying (or
// waiting for the next cold start — no code change needed).
//
// IMPORTANT: only ever add NON-SECRET values here. META_ACCESS_TOKEN (the
// Conversions API token) must never be exposed through this endpoint —
// it stays server-side only, inside notify-order.js.

exports.handler = async () => {
  const pixelId = process.env.META_PIXEL_ID || null;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // 5 min — short enough that a new Pixel ID shows up quickly
    },
    body: JSON.stringify({ pixelId })
  };
};
