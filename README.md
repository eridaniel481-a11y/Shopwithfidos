# ShopWithFidos Landing Page — Deploy & Edit Guide

*Last verified against Namecheap's and Netlify's live documentation and product pages: July 25, 2026. Dashboard wording can shift over time — if a label doesn't match exactly, the underlying steps still apply.*

Two core pages, zero build step: `index.html` (landing + order form) and `thank-you.html` (confirmation). Product photos are embedded directly inside `index.html` as base64 data, so there's no separate image folder to keep track of, and nothing breaks if you move or rename the file. The product demo video lives at `assets/product-demo.mp4` and is linked (not embedded as base64) since video files are too large for that to be practical.

There's also an optional `netlify/functions/notify-order.js` and `netlify.toml` for the upgraded order-email system (see `CREDENTIALS-SETUP-GUIDE.md` §10–11). The site works perfectly without them, that's just an upgrade path once you're ready.

**To swap a photo:** compress the new image (keep it under ~150KB — large uncompressed photos will bloat the page and slow it down), convert it to base64, and replace the matching `data:image/jpeg;base64,...` string in `index.html`. Ask Claude to do this for you if you're not comfortable doing it by hand.

## 1. Before you launch — edit these

Search the files for `EDIT:` comments — every one flags something you must change:

| What | File | Where |
|---|---|---|
| Meta Pixel ID | `index.html`, `thank-you.html` | `<head>`, commented-out block near the top — uncomment once you have a real Pixel ID |
| Phone number | `index.html` | header `tel:` link, and the form-error fallback message in the script |
| Prices (hero tag + package options) | `index.html` | `#priceWas` / `#priceNow`, and the three `.pkg-option` rows in the form |
| Real offer end date | `index.html` | `OFFER_END` constant near the bottom script — this drives the **real** countdown |
| Order notification email | Netlify site dashboard | No code edit needed — the form is already wired for Netlify Forms. Set the notification email under Project configuration → Notifications → Form submission notifications (full steps in `CREDENTIALS-SETUP-GUIDE.md` §3) |
| Testimonials | `index.html` | three `.testi-card` blocks are marked `PLACEHOLDER` — swap in real customer quotes (with permission) before running paid traffic |
| Business name / year / policy links | `index.html` footer | `<footer>` |

## 2. Why the countdown and social proof are "real" this time

- The countdown ticks down to an actual `Date` you set (`OFFER_END`), not a timer that silently resets every visit. Once it passes, the banner honestly says the price window closed instead of looping forever.
- The testimonial cards are placeholders clearly flagged for you to replace with real customer quotes — nothing is presented as a live "someone just bought this" feed, since that can't be made truthful without real order data behind it.
- If you later want a genuine live purchase ticker, that requires a small backend (e.g., a Netlify Function reading real order counts from a database) — happy to build that once the client has real sales flowing through Netlify Forms.

## 3. Buy the domain through Namecheap

Namecheap is one of the largest domain registrars in the world (it's their core business, hosting is secondary for them), so yes — it sells domains, and it's a solid choice.

**Pricing to expect:** a `.com` typically runs **~$9–10** for the first year (sometimes promo'd down to ~$6–7), with **renewal around $13–14/year** plus a small fixed ICANN fee (~$0.20). The gap between first-year and renewal price is normal across almost every registrar — just budget for the renewal number, not the year-one teaser. Free WHOIS privacy (Namecheap calls it "Withheld for Privacy") is included automatically.

**Since you're going with `shopwithfidos.online` specifically:** `.online` is a newer TLD that Namecheap and others frequently promote at a very low first-year price (sometimes under $1), but its **renewal price is set by the registry and is typically much higher than `.com`** — often in the $30–35/year range. This isn't a Namecheap markup, it's how the `.online` registry prices the extension industry-wide. **Check the exact renewal figure shown at checkout before buying**, and make sure the client knows that number going forward, not just the attractive year-one price.

**Steps:**

1. Go to [namecheap.com](https://www.namecheap.com) and search the domain you want (e.g. `shopwithfidos.online`).
2. Check availability, add it to your cart.
3. At checkout, Namecheap will try to upsell you on hosting, SSL, premium DNS, and email — **uncheck all of these**. You only need the domain itself; Netlify is handling hosting and SSL for free.
4. Confirm WHOIS privacy shows as included/free (it should be automatic).
5. Create a Namecheap account if you don't have one, and pay (card or PayPal both work, so a Nigerian bank card enabled for online/international payments is fine).
6. **Verify your registrant email** — ICANN requires this. Namecheap sends a verification link after purchase; you have about 15 days to click it. Skip it and the domain can be suspended. Do this immediately after buying.
7. (Optional but recommended) Turn on two-factor authentication on your Namecheap account, since a hijacked domain account is a real business risk.

Once bought, the domain sits in your Namecheap dashboard under **Domain List**. It is **not** connected to anything yet — that's what section 4 below does.

## 4. Deploy to Netlify

**Prerequisites:** a free GitHub account (same as before), and Git installed on your computer (or upload files directly through GitHub's website if you'd rather skip the command line).

**Step 1 — Put the code on GitHub**

If you're comfortable with the command line, from inside this folder:
```
git init
git add .
git commit -m "ShopWithFidos landing page"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/shopwithfidos-landing.git
git push -u origin main
```
*(Create the empty repo first at [github.com/new](https://github.com/new) before running the last two lines.)*

No command line? Create the repo at [github.com/new](https://github.com/new), then on the repo page click **Add file → Upload files**, and drag in `index.html`, `thank-you.html`, `README.md`, `CREDENTIALS-SETUP-GUIDE.md`, `netlify.toml`, the `assets` folder (contains the product video), and the `netlify/functions` folder (contains the optional order-email upgrade). Commit directly to `main`.

**Step 2 — Create the Netlify site**

1. Go to [app.netlify.com](https://app.netlify.com) and sign up / log in (free — GitHub sign-in is the fastest option, and it also handles the authorization step below automatically).
2. Click **Add new site → Import an existing project**.
3. Choose **Deploy with GitHub**, authorize Netlify to access your account (first time only), then pick the `shopwithfidos-landing` repo.
4. Build settings screen — since this is plain HTML/CSS/JS with no build step, set:
   - **Build command:** *(leave blank)*
   - **Publish directory:** `/` (or leave as the repo root — same thing)
5. Click **Deploy site**. The first deploy takes under a minute. You'll land on a live URL like `shopwithfidos-landing.netlify.app` — open it to confirm the page loads correctly.
6. Check the **Forms** tab in the site dashboard — since the order form already has `data-netlify="true"` built in, Netlify should detect it automatically on this first deploy and list it as "order-form." If it doesn't appear, go to **Forms → Usage and configuration → Form detection** and enable it, then redeploy. Once it's detected, set up the email notification so orders actually reach an inbox — full steps for that are in `CREDENTIALS-SETUP-GUIDE.md` §3.

**Step 3 — Attach the custom domain**

1. Inside the site dashboard, left sidebar → **Domain management** → **Add a domain** → **Add a domain you already own**.
2. Type your domain (e.g. `shopwithfidos.online`) and follow the prompts. Netlify checks it's registered, then asks how you want to manage DNS: **Netlify DNS** or **External DNS**. Pick **External DNS** — simpler when the domain stays registered at Namecheap and you're just pointing it at Netlify (Netlify DNS would mean handing Netlify your nameservers instead, which also works but is an extra migration step you don't need).
3. Netlify shows you the exact records to add. As of mid-2026 these are, for an external DNS setup:

   | Type | Host | Value | Purpose |
   |---|---|---|---|
   | A | `@` | `75.2.60.5` | Apex domain (`shopwithfidos.online`) |
   | CNAME | `www` | `shopwithfidos-landing.netlify.app` | `www.shopwithfidos.online` |

   *Always double-check the exact values shown in your own Netlify dashboard at setup time — Netlify notes these can change, so treat the table above as "what to expect," not a value to copy blind.*

4. Log into **Namecheap → Domain List → Manage → Advanced DNS**, and add those records there (Namecheap calls the interface "Advanced DNS," under **Host Records**). Leave nameservers as Namecheap's default — you don't need to change them for this method.
5. Save, then go back to Netlify — it'll show **Pending DNS verification** until the records propagate (usually 5–30 minutes, occasionally up to a day). Refresh or click into the domain to re-check status.
6. **SSL is automatic and free** once verification completes — Netlify provisions a Let's Encrypt certificate for you with zero manual steps. `https://shopwithfidos.online` will show the padlock as soon as the domain shows **Netlify DNS verified / SSL active**.

**Step 4 — Every future update**

Any time you (or Claude) edit `index.html` and push the change to the `main` branch on GitHub, Netlify redeploys automatically within seconds — nothing to trigger manually. If a change goes wrong, the **Deploys** tab lets you roll back to any previous version with one click.

*Verified against Namecheap's and Netlify's current documentation as of July 2026. If a "Pending DNS verification" status sits for more than 24 hours, double-check the exact record values against what your own Netlify dashboard shows (they're project-specific), confirm you added them to the correct domain in Namecheap, and note that apex-domain DNS changes can occasionally take up to 48 hours in rare cases.*

## 5. Meta setup checklist

1. Create the Pixel in Meta Events Manager, grab the Pixel ID.
2. Paste it into the two commented-out Pixel blocks (`index.html` head, `thank-you.html` head) and uncomment them.
3. Uncomment the two `fbq('track', ...)` lines inside the form-submit and focus handlers in `index.html`.
4. Verify the domain in Meta Business Manager → Brand Safety → Domains (DNS TXT record via your registrar, or upload the HTML file Meta gives you into this folder's root and redeploy).
5. Test with the Meta Pixel Helper Chrome extension, then click your own live ad from a phone to confirm the in-app browser fires events correctly.

## 6. What's already handled

- Mobile-first, sticky order CTA on small screens
- Honeypot spam field on the order form (bots fill it, humans never see it)
- Reduced-motion respected, visible keyboard focus states
- No fake urgency — countdown and testimonials are structured so they're either true or clearly marked as placeholders
