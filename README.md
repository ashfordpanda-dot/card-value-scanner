# Matchday Value — Football Card Price Lookup

A small web app: enter a football (soccer) card's details, and it searches
live eBay listings to estimate what the card is currently worth.

This is a **starting slice**, not a finished Card Ladder clone — see
"What this doesn't do yet" below.

## What it does

- Takes structured card details (player, year, set, card number, parallel,
  grade, condition) instead of a free-text search, which matches real
  listing titles much better.
- Calls eBay's official **Browse API** to pull current listings.
- Computes a median / average / low–high range from the results.
- Shows each listing with a link back to eBay so you can sanity-check the
  comps yourself.

## What this doesn't do yet

- **No photo scanning.** You type in the card details manually. Adding a
  camera-based identification step (OCR or image matching) is a separate,
  harder project — happy to help with that next once this piece is working.
- **No sold-price history.** eBay's Browse API only returns *active*
  listings — what people are asking, not what buyers actually paid. Real
  sold-comp data lives behind eBay's **Marketplace Insights API**, which
  needs separate partner approval (you apply from inside the eBay Developer
  Program once you already have an app set up). The app is built so you can
  swap in that data source later without changing the frontend.
- **No persistent database.** Every search hits eBay live; nothing is saved.

## Setup

1. **Get eBay API credentials.**
   Go to <https://developer.ebay.com/my/keys>, sign up for a developer
   account if you don't have one, and create an application. You'll get a
   Client ID and Client Secret. Start with **Sandbox** keys — they let you
   test against fake data without a production approval process.

2. **Install dependencies.**
   ```bash
   cd card-value-scanner
   npm install
   ```

3. **Configure your environment.**
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and fill in `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`.
   Leave `EBAY_ENV=sandbox` to start.

4. **Run it.**
   ```bash
   npm start
   ```
   Then open <http://localhost:3000> in your browser (this works fine from
   an Android phone's browser too, as long as the phone can reach whatever
   machine is running the server — e.g. both on the same Wi-Fi, or deployed
   somewhere public).

5. **Go live.** Once you've confirmed searches work against the sandbox,
   apply for **production** keys in the eBay Developer Program, set
   `EBAY_ENV=production` and swap in the production Client ID/Secret. Real
   listings will start showing up.

## Project structure

```
card-value-scanner/
├── server.js         # Express server, exposes /api/search
├── ebayClient.js      # eBay OAuth + Browse API calls, price math
├── public/
│   ├── index.html      # Search form + results ledger
│   ├── style.css
│   └── app.js
├── .env.example
└── package.json
```

## Deploying so it works from your Android phone anywhere

Running `npm start` only serves it on your own machine. To use it from
your phone away from home, deploy the whole `card-value-scanner` folder to
a small host that runs Node — Render, Railway, Fly.io, or a basic VPS all
work — and set the same environment variables there. Then just open the
deployed URL in your phone's browser like any website; no app install
needed. Because Chrome and other Android browsers support "Add to Home
Screen", you can make it feel like an installed app without building a
native one.

## Suggested next steps

1. **Verify the trading-card category filter.** `ebayClient.js` accepts
   an optional `categoryId` — search eBay.com for a soccer card, check
   what category the URL/results imply, and pass that ID from the frontend
   if you want to filter out non-card junk more aggressively.
2. **Add photo-based identification.** Once this is working, the natural
   next step is a camera capture screen that runs OCR (e.g. Google Cloud
   Vision, Tesseract) on the photo to pre-fill the player/year/set fields.
3. **Apply for Marketplace Insights access** if you want real sold-price
   comps instead of active-listing asking prices.
4. **Cache results** so repeated searches for the same card don't hit
   eBay every time.
