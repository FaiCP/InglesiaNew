import { AdminLogin } from "@/components/admin-login";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "min(560px, 100%)",
          display: "grid",
          gap: "20px",
          padding: "28px",
          borderRadius: "28px",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div>
          <p className="mono">ACCESO ADMIN</p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.2rem, 5vw, 3.8rem)", margin: 0 }}>
            Iniciar sesión como administrador
          </h1>
          <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>
            Solo el administrador puede publicar noticias y crear eventos.
          </p>
        </div>
        <AdminLogin />
      </section>
    </main>
  );
}
