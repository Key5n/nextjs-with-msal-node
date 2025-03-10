## Getting Started

First, fill in the following environment variable according to your Entra ID instance.

- TENANT_ID
- CLIENT_ID
- CLIENT_SECRET
- CLOUD_INSTANCE

Second, run the following command to generate a secret key and set the `SESSION_SECRET` with the secret key you generated now (this key is used to sign sessions):

```
openssl rand -base64 32
```

Third, uncomment `REDIRECT_URI` or change it when you change a directory structure of `/api/auth/callback/microsoft-entra-id`.

Then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
