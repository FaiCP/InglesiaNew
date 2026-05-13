"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin-login.module.css";

export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@iglesia.local");
  const [password, setPassword] = useState("admin1234");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "No se pudo iniciar sesión");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setMessage("No se pudo iniciar sesión");
      setLoading(false);
    }
  };

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <label>
        Correo de admin
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Contraseña
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <p className={styles.note}>
        Valores por defecto de desarrollo: <strong>admin@iglesia.local</strong> y{" "}
        <strong>admin1234</strong>.
      </p>
      {message ? <p className={styles.error}>{message}</p> : null}
      <button className={styles.button} type="submit" disabled={loading}>
        {loading ? "Ingresando..." : "Entrar como admin"}
      </button>
    </form>
  );
}
