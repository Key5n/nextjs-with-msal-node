if (!process.env.CLIENT_ID) {
  throw new Error("CLIENT_ID is undefined");
}

if (!process.env.CLIENT_SECRET) {
  throw new Error("TENANT_ID is undefined");
}

if (!process.env.TENANT_ID) {
  throw new Error("CLIENT_SECRET is undefined");
}

if (!process.env.CLOUD_INSTANCE) {
  throw new Error("CLOUD_INSTANCE is undefined");
}

if (!process.env.REDIRECT_URI) {
  throw new Error("REDIRECT_URI is undefined");
}

export const CLIENT_ID = process.env.CLIENT_ID;
export const CLIENT_SECRET = process.env.CLIENT_SECRET;
export const TENANT_ID = process.env.TENANT_ID;
export const CLOUD_INSTANCE = process.env.CLOUD_INSTANCE;
export const REDIRECT_URI = process.env.REDIRECT_URI;
