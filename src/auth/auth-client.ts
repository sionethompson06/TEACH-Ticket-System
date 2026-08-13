"use client";

import { createAuthClient } from "better-auth/react";

// Talks to the same-origin /api/auth/* routes; never touches server-only
// environment variables or the database directly.
export const authClient = createAuthClient();
