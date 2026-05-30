import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

export type Locale = "en" | "es";

async function detectLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get("locale")?.value;
  if (saved === "en" || saved === "es") return saved;

  // Auto-detect from browser Accept-Language header
  const headerStore = await headers();
  const acceptLang = headerStore.get("accept-language") ?? "";
  const primary = acceptLang.split(",")[0]?.split("-")[0]?.toLowerCase();
  return primary === "es" ? "es" : "en";
}

async function loadMessages(locale: Locale) {
  if (locale === "es") return (await import("../messages/es.json")).default;
  return (await import("../messages/en.json")).default;
}

export default getRequestConfig(async () => {
  const locale = await detectLocale();
  return {
    locale,
    messages: await loadMessages(locale),
  };
});
