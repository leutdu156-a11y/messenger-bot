# Deploy on Render

Build Command: `npm install`

Start Command: `npm start`

Required environment variables:
- `META_VERIFY_TOKEN`
- `META_PAGE_ACCESS_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Notes:
- Render provides `PORT` dynamically at runtime.
- The app must bind to `0.0.0.0`.
- Keep secrets in the Render environment settings, not in code.
