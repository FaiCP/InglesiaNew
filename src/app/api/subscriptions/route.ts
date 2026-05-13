import { NextResponse } from "next/server";
import { saveSubscription } from "@/lib/server-db";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;

    const saved = await saveSubscription({
      displayName: String(payload.displayName ?? "Dispositivo anónimo"),
      channel: String(payload.channel ?? "push") as "push" | "push-email",
      allowAnonymous: Boolean(payload.allowAnonymous ?? true),
      topics: Array.isArray(payload.topics)
        ? payload.topics.map((topic) => String(topic))
        : ["eventos", "noticias"],
    });

    return NextResponse.json({ ok: true, item: saved });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to save subscription",
      },
      { status: 500 }
    );
  }
}
