import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/auth/auth";

// The handler wrapper is lazy on purpose: `getAuth()` is only called once a
// request actually arrives, never at module-import or build time, so
// `next build` never needs DATABASE_URL or Google credentials to succeed.
export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler((request) =>
  getAuth().handler(request),
);
