import { ChannelList } from "@/components/channel-list";
import { NewChannelForm } from "@/components/new-channel-form";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const channels = await store.listChannels();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">マルチプレイヤー・チャンネル</h1>
        <p className="mt-1 text-sm opacity-70">
          チャンネルごとに1体の共有アシスタント。複数人が同じ会話をリアルタイムで共有します。
        </p>
      </header>

      <NewChannelForm />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium opacity-70">チャンネル一覧</h2>
        {channels.length === 0 ? (
          <p className="rounded-md border border-dashed border-black/15 p-6 text-center text-sm opacity-60 dark:border-white/20">
            まだチャンネルがありません。上のフォームから作成してください。
          </p>
        ) : (
          <ChannelList channels={channels} />
        )}
      </section>
    </main>
  );
}
