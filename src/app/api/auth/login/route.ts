import { NextResponse } from "next/server";
import {
  adminCookieName,
  createSessionCookie,
  validateAdminCredentials,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = String(payload.email ?? "").trim();
    const password = String(payload.password ?? "");

    if (!validateAdminCredentials(email, password)) {
      return NextResponse.json(
        { ok: false, message: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true, email });
    response.cookies.set({
      name: adminCookieName(),
      value: encodeURIComponent(createSessionCookie(email)),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "No se pudo iniciar sesión",
      },
      { status: 500 }
    );
  }
}
