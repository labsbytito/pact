# Pact

A little intention. A real next step.

Pact is a Chrome side panel. Read a page when you choose, talk it through, and approve one request before Fo sees it.

## Demo on your machine

Node 20 or newer, and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm --filter backend dev
```

In another terminal:

```sh
pnpm dev
```

Load `.output/chrome-mv3` from `chrome://extensions` with Developer mode on. Open an ordinary webpage and click the Pact icon.

The backend starts in demo mode when you set both of these:

```sh
PACT_AI=mock FO_MODE=mock pnpm --filter backend dev
```

Mocks are refused when `VERCEL_ENV=production`.

For a live Claude reply, leave `PACT_AI` unset and put your key only on the backend:

```sh
ANTHROPIC_API_KEY=your_key ANTHROPIC_MODEL=claude-sonnet-5-5 pnpm --filter backend dev
```

Fo sign-in is **Settings → Connections → Connect Fo**. The callback is `http://localhost:3000/api/fo/callback`. Tokens stay encrypted under `backend/.local/`.

## Deploy the backend on Vercel

1. Import this repo.
2. Set the root directory to `backend`.
3. Add the variables from `backend/.env.example`. `FO_TOKEN_ENC_KEY` is 32 bytes, base64. `PUBLIC_BASE_URL` is the Vercel URL. `ALLOWED_EXTENSION_IDS` stays `iogfficoaeonclfkgdjfgfdiofdjcbnn` for the unpacked release.
4. Deploy.

If the Vercel URL is not `https://pact.vercel.app`, change `WXT_PUBLIC_PACT_API` in `.env.production` before building the zip.

## Extension for judges

```sh
pnpm zip:release
```

Unzip the file in `.output/` and follow [INSTALL.md](INSTALL.md). That build talks to the production URL in `.env.production`. The manifest key stays so the extension id matches the backend allow list.

`pnpm zip` is the store build. It strips the key.

## Verify

```sh
pnpm install --frozen-lockfile
pnpm -r check
pnpm -r test
pnpm build
pnpm --filter backend build
```

See [PACT.md](PACT.md), [docs/DESIGN-SOURCE.md](docs/DESIGN-SOURCE.md), and [FO-INTEGRATION.md](FO-INTEGRATION.md).
