import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const channels = await store.listChannels();
  return Response.json({ channels });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const name = (body as { name?: unknown })?.name;
  if (typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  const channel = await store.createChannel(name);
  return Response.json({ channel }, { status: 201 });
}
