import { NextResponse } from "next/server";
import { isContentKind, seedDashboard } from "@/lib/church-data";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  loadDashboardData,
  saveEvent,
  savePost,
} from "@/lib/server-db";

export async function GET() {
  try {
    const data = await loadDashboardData();
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        reason: "db-unavailable",
        ...seedDashboard,
      },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const kind = String(payload.kind ?? "");

    if (kind === "post" && isContentKind(String(payload.contentKind ?? ""))) {
      const saved = await savePost({
        kind: String(payload.contentKind) as "news" | "advertisement",
        title: String(payload.title ?? "").trim(),
        summary: String(payload.summary ?? "").trim(),
        body: String(payload.body ?? "").trim(),
        audience: String(payload.audience ?? "Toda la iglesia") as
          | "Toda la iglesia"
          | "Jóvenes"
          | "Líderes"
          | "Voluntarios",
        featured: Boolean(payload.featured),
      });

      const data = await loadDashboardData();
      return NextResponse.json({ ok: true, item: saved, ...data });
    }

    if (kind === "event") {
      const saved = await saveEvent({
        title: String(payload.title ?? "").trim(),
        description: String(payload.description ?? "").trim(),
        location: String(payload.location ?? "").trim(),
        startsAt: String(payload.startsAt ?? new Date().toISOString()),
        reminderMinutes: Number(payload.reminderMinutes ?? 60),
        category: String(payload.category ?? "General"),
        featured: Boolean(payload.featured),
      });

      const data = await loadDashboardData();
      return NextResponse.json({ ok: true, item: saved, ...data });
    }

    return NextResponse.json(
      { ok: false, message: "Invalid payload" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to save content",
      },
      { status: 500 }
    );
  }
}
