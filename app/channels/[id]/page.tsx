import { notFound } from "next/navigation";
import { ChannelView } from "@/components/channel-view";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const channel = await store.getChannel(id);
  if (!channel) notFound();

  const messages = await store.getMessages(id);
  return (
    <ChannelView
      channelId={channel.id}
      channelName={channel.name}
      initialMessages={messages}
    />
  );
}
