# OpenLabel

Discover what's really inside packaged food and drinks. 

Use your device camera to scan a product barcode or manually enter the barcode number to retrieve nutrition facts, ingredient details (including additives and preservatives), and an overall product score. An integrated AI assistant answers follow-up questions about the product and its ingredients.

## Key features

- Barcode scanning via device camera (mobile and desktop camera support where available)
- Manual barcode entry when scanning isn't possible or convenient
- Nutrition facts lookup for scanned products
- Ingredient analysis including additives, preservatives, and potentially concerning e-numbers
- A simple overall product score based on the nutrition and ingredient analysis
- AI chat for follow-up questions about a product, ingredients, or dietary concerns
- Lightweight, privacy-conscious frontend built with Next.js

## How it works (high level)

1. The user scans a barcode using their device camera or enters the barcode number manually.
2. The site then decodes the image to get the barcode number or looks up the barcode number through the barcode search tool. 
3. Then uses `openfoodfacts` to get product data.
3. Ingredient lists and e-number/additive data are analyzed from rules (see `lib/additive-rules.json` and `lib/e-numbers.json`).
4. The site computes an overall score and displays nutrition, additives, and other details.
5. The user can ask the integrated AI assistant for more context or to explain ingredients and follow-up questions.

## Local development

Prerequisites: Node.js (16+ recommended) and npm or pnpm.

1. Install dependencies

```bash
npm install
```

2. Run the dev server

```bash
npm run dev
```

3. Open http://localhost:3000 in your browser and try the scan page or the manual barcode input.

Note: Camera access requires HTTPS or localhost and user permission. For mobile testing, open the app on your phone using the machine's IP or host it via a secure tunnel.

## Configuration & environment

- AI features may rely on API keys (for example OpenAI). Check the `app/api/openai/route.ts` and the project environment variables, and add any required keys to your environment (for example via `.env.local`).
- Product lookup can be backed by third-party product APIs; add keys or adjust the server routes in `app/api/product/route.ts` if necessary.

## Roadmap & Todos

- [ ] Improve camera barcode auto detection.
- [ ] Explore additional data sources for missing product data.
