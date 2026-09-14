# TrackMarket

A fast, client-side financial market analytics dashboard and equity research terminal.

Built with **Preact**, **@preact/signals**, **TypeScript**, **Tailwind CSS v4**, and **Google Gemini 3.6 Flash**.

[Live Demo](https://trackmarket.dev)

---

## Overview

TrackMarket is a serverless Single Page Application (SPA) designed for tracking, visualizing, and researching stocks across North American exchanges (NYSE, NASDAQ, and TSX). 

It uses **Preact Signals** for fine-grained, reactive DOM updates, allowing live stock prices to stream and update without triggering heavy component re-renders. By integrating **Google Gemini 3.6 Flash** with **Search Grounding**, the app can fetch real-time market data directly from the web and generate structured analyst reports, bypassing the need for a dedicated backend API.

## Features

- **Search-Grounded Data:** Bypasses traditional expensive financial APIs by using Google Search Grounding to fetch live quotes.
- **Preact Signals Architecture:** Reactive state management for high-frequency price updates without React-style render cycles.
- **Zero-Dependency SVG Charting:** Hand-crafted, responsive SVG vector charts with interactive crosshairs and multi-timeframe toggling—no heavy external charting libraries.
- **Smart Synchronization:** Automatically syncs portfolio prices at market open (9:30 AM ET) and close (4:00 PM ET).
- **AI Analyst Suite:** Generates structured research reports covering business moats, growth catalysts, risk analysis, and recent price drivers.
- **Local Persistence:** Watchlists and API keys are stored securely in the browser's `localStorage`.

## Keyboard Shortcuts

- `Shift + A` - Add a random stock
- `Shift + D` - Delete selected stocks
- `Shift + C` - Clear selection
- `Shift + U` - Undo action
- `Shift + R` - Redo action

## Development

TrackMarket requires Node.js v18+.

```bash
git clone https://github.com/Tofaluu/track-market.git
cd track-market
npm install
npm run dev
```

## AI Setup

To enable live price syncing and AI research, you will need a free Gemini API key:
1. Get a key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click the Settings icon in TrackMarket.
3. Paste and save your key.

*Note: Your key is stored locally in your browser and communicates directly with Google's API.*

## Deployment

The project is configured to deploy automatically to GitHub Pages via GitHub Actions whenever changes are pushed to the `main` branch. 

---
*Crafted by Thomas Liu (2026)*
