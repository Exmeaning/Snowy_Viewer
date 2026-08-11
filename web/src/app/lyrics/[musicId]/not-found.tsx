import MainLayout from "@/components/MainLayout";
import Link from "@/components/LocalizedLink";
import { fallbackMessages, getMessageByPath, messagesByLocale } from "@/lib/i18n";
import { getRequestSeoLocale } from "@/lib/seo-metadata";

export default async function LyricsNotFound() {
  const locale = await getRequestSeoLocale();
  const message = (key: string) => getMessageByPath(messagesByLocale[locale], key)
    ?? getMessageByPath(fallbackMessages, key)
    ?? key;

  return (
    <MainLayout>
      <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center sm:px-6">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-miku">404</p>
        <h1 className="mt-3 text-2xl font-black text-primary-text sm:text-3xl">
          {message("page.lyrics.notFound")}
        </h1>
        <Link
          href="/lyrics"
          className="ios-glass-btn mt-7 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-slate-500 hover:text-miku"
        >
          <span aria-hidden="true">←</span>
          {message("page.lyrics.backToList")}
        </Link>
      </div>
    </MainLayout>
  );
}
