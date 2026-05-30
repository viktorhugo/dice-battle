"use server";

import { cookies } from "next/headers";

export async function setLocaleCookie(locale: "en" | "es") {
  const store = await cookies();
  store.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
