"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  ChurchEvent,
  ChurchPost,
  DashboardSeed,
  NotificationChannel,
  NotificationSubscription,
} from "@/lib/church-data";
import { createId, seedDashboard, sortEvents, sortPosts } from "@/lib/church-data";
import styles from "./church-dashboard.module.css";

type DashboardProps = {
  dbReady: boolean;
};

type Toast = {
  title: string;
  message: string;
};

const storageKey = "control-de-iglesias.dashboard";
const subscriptionKey = "control-de-iglesias.subscription";

const postKinds = [
  { value: "news", label: "Noticia" },
  { value: "advertisement", label: "Publicidad" },
] as const;

const audiences = ["Toda la iglesia", "Jóvenes", "Líderes", "Voluntarios"] as const;

const notificationTopics = ["eventos", "noticias", "recordatorios"] as const;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "full",
  }).format(new Date(value));
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(cursor: Date, events: ChurchEvent[]) {
  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  const startDay = (first.getDay() + 6) % 7;
  const totalDays = last.getDate();
  const grid: Array<Date | null> = [];

  for (let index = 0; index < startDay; index += 1) {
    grid.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    grid.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
  }

  while (grid.length % 7 !== 0) {
    grid.push(null);
  }

  const eventMap = new Map<string, ChurchEvent[]>();
  for (const event of events) {
    const key = dateKey(new Date(event.startsAt));
    const bucket = eventMap.get(key) ?? [];
    bucket.push(event);
    eventMap.set(key, bucket);
  }

  return grid.map((day) => ({
    day,
    events: day ? eventMap.get(dateKey(day)) ?? [] : [],
  }));
}

function initialState(): DashboardSeed {
  return {
    posts: seedDashboard.posts,
    events: seedDashboard.events,
    subscriptions: seedDashboard.subscriptions,
  };
}

function normalizeDashboard(data: Partial<DashboardSeed>): DashboardSeed {
  return {
    posts: sortPosts(data.posts ?? seedDashboard.posts),
    events: sortEvents(data.events ?? seedDashboard.events),
    subscriptions: data.subscriptions ?? seedDashboard.subscriptions,
  };
}

async function safeJsonFetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function loadFromStorage(): DashboardSeed {
  if (typeof window === "undefined") {
    return initialState();
  }

  const raw = window.localStorage.getItem(storageKey);

  if (!raw) {
    return initialState();
  }

  try {
    const parsed = JSON.parse(raw) as DashboardSeed;
    return normalizeDashboard(parsed);
  } catch {
    return initialState();
  }
}

function saveToStorage(data: DashboardSeed) {
  window.localStorage.setItem(storageKey, JSON.stringify(data));
}

function loadSubscription(): NotificationSubscription | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(subscriptionKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as NotificationSubscription;
  } catch {
    return null;
  }
}

function saveSubscription(subscription: NotificationSubscription) {
  window.localStorage.setItem(subscriptionKey, JSON.stringify(subscription));
}

function buildSubscription(
  channel: NotificationChannel,
  allowAnonymous: boolean,
  displayName: string
) {
  return {
    id: createId("sub-local"),
    displayName: allowAnonymous ? "Dispositivo anónimo" : displayName.trim() || "Administrador",
    channel,
    allowAnonymous,
    topics: ["eventos", "noticias", "recordatorios"],
    createdAt: new Date().toISOString(),
  } satisfies NotificationSubscription;
}

function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window === "undefined" ? "default" : window.Notification?.permission ?? "default"
  );

  return [permission, setPermission] as const;
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={styles.statValue}>{value}</strong>
      <p className={styles.statDescription}>{description}</p>
    </article>
  );
}

function SectionHeader({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <header className={styles.sectionHeader}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      <p>{copy}</p>
    </header>
  );
}

export function ChurchDashboard({ dbReady }: DashboardProps) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<DashboardSeed>(initialState);
  const [activeMonth, setActiveMonth] = useState(() => new Date());
  const [dbMode, setDbMode] = useState<"remote" | "local">("local");
  const [toast, setToast] = useState<Toast | null>(null);
  const [permission, setPermission] = useNotificationPermission();
  const [subscription, setSubscription] = useState<NotificationSubscription | null>(() => loadSubscription());
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [adminLogin, setAdminLogin] = useState({
    email: "admin@iglesia.local",
    password: "admin1234",
  });
  const [contentKind, setContentKind] = useState<"news" | "advertisement">("news");
  const [featuredPost, setFeaturedPost] = useState(false);
  const [featuredEvent, setFeaturedEvent] = useState(true);

  const [postForm, setPostForm] = useState({
    title: "",
    summary: "",
    body: "",
    audience: "Toda la iglesia" as (typeof audiences)[number],
  });
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    location: "",
    startsAt: "",
    reminderMinutes: 60,
    category: "General",
  });
  const [subscriptionForm, setSubscriptionForm] = useState(() => {
    const stored = loadSubscription();
    return {
      displayName: stored?.displayName ?? "Dispositivo anónimo",
      channel: stored?.channel ?? ("push" as NotificationChannel),
      allowAnonymous: stored?.allowAnonymous ?? true,
    };
  });

  const upcomingEvents = useMemo(() => sortEvents(data.events).slice(0, 4), [data.events]);
  const highlightedPosts = useMemo(
    () => [...sortPosts(data.posts)].sort((left, right) => Number(right.featured) - Number(left.featured)),
    [data.posts]
  );
  const calendarDays = useMemo(
    () => buildCalendarDays(activeMonth, sortEvents(data.events)),
    [activeMonth, data.events]
  );
  const totalSubscribers = data.subscriptions.length;
  const totalPosts = data.posts.length;
  const totalEvents = data.events.length;

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      const remote = await safeJsonFetch<DashboardSeed & { ok?: boolean }>("/api/content");
      if (!isMounted) {
        return;
      }

      if (remote?.ok) {
        const normalized = normalizeDashboard(remote);
        setData(normalized);
        setDbMode("remote");
        saveToStorage(normalized);
      } else {
        const local = loadFromStorage();
        setData(local);
        setDbMode("local");
      }

      setReady(true);
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      const response = await safeJsonFetch<{ authenticated?: boolean; email?: string }>("/api/auth/me");
      if (!isMounted) {
        return;
      }

      setIsAdmin(Boolean(response?.authenticated));
      setAdminEmail(response?.email ?? null);
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    saveToStorage(data);
  }, [data, ready]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const pushToast = (title: string, message: string) => {
    setToast({ title, message });
  };

  const handleAdminLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const response = await safeJsonFetch<{ ok?: boolean; email?: string; message?: string }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(adminLogin),
      }
    );

    if (!response?.ok) {
      pushToast("Acceso denegado", response?.message ?? "Credenciales inválidas");
      return;
    }

    setIsAdmin(true);
    setAdminEmail(response.email ?? adminLogin.email);
    pushToast("Sesión iniciada", "Ya puedes publicar contenido como administrador.");
  };

  const handleAdminLogout = async () => {
    await safeJsonFetch("/api/auth/logout", { method: "POST" });
    setIsAdmin(false);
    setAdminEmail(null);
    pushToast("Sesión cerrada", "El panel administrativo quedó bloqueado.");
  };

  const maybeNotify = async (title: string, body: string) => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.Notification?.permission === "granted") {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        if (registration) {
          await registration.showNotification(title, {
            body,
            icon: "/icon.svg",
            badge: "/icon.svg",
          });
          return;
        }
      }

      new Notification(title, {
        body,
        icon: "/icon.svg",
      });
    }
  };

  const persistContent = async (nextData: DashboardSeed) => {
    setData(nextData);
    saveToStorage(nextData);
  };

  const handlePostSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      kind: "post",
      contentKind,
      title: postForm.title.trim(),
      summary: postForm.summary.trim(),
      body: postForm.body.trim(),
      audience: postForm.audience,
      featured: featuredPost,
    };

    if (!payload.title || !payload.summary || !payload.body) {
      pushToast("Faltan datos", "Completa título, resumen y cuerpo antes de publicar.");
      return;
    }

    if (!isAdmin) {
      pushToast("Acceso requerido", "Inicia sesión como administrador para publicar.");
      return;
    }

    const optimisticPost: ChurchPost = {
      id: createId("post-local"),
      kind: contentKind,
      title: payload.title,
      summary: payload.summary,
      body: payload.body,
      audience: payload.audience,
      featured: payload.featured,
      publishedAt: new Date().toISOString(),
    };

    const optimistic = normalizeDashboard({
      ...data,
      posts: [optimisticPost, ...data.posts],
    });

    await persistContent(optimistic);

    const response = await safeJsonFetch<{ ok?: boolean; posts?: ChurchPost[]; events?: ChurchEvent[] }>(
      "/api/content",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    if (response?.ok && response.posts && response.events) {
      const synced = normalizeDashboard({
        posts: response.posts,
        events: response.events,
        subscriptions: data.subscriptions,
      });
      await persistContent(synced);
      pushToast("Contenido publicado", "La noticia quedó guardada en el feed y lista para notificar.");
      void maybeNotify(payload.title, payload.summary);
    } else {
      pushToast("Guardado localmente", "La publicación quedó en el navegador mientras conectas la base.");
      void maybeNotify(payload.title, payload.summary);
    }

    setPostForm({
      title: "",
      summary: "",
      body: "",
      audience: postForm.audience,
    });
    setFeaturedPost(false);
  };

  const handleEventSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      kind: "event",
      title: eventForm.title.trim(),
      description: eventForm.description.trim(),
      location: eventForm.location.trim(),
      startsAt: eventForm.startsAt,
      reminderMinutes: Number(eventForm.reminderMinutes),
      category: eventForm.category.trim() || "General",
      featured: featuredEvent,
    };

    if (!payload.title || !payload.description || !payload.location || !payload.startsAt) {
      pushToast("Faltan datos", "Completa título, descripción, lugar y fecha del evento.");
      return;
    }

    if (!isAdmin) {
      pushToast("Acceso requerido", "Inicia sesión como administrador para crear eventos.");
      return;
    }

    const optimisticEvent: ChurchEvent = {
      id: createId("event-local"),
      title: payload.title,
      description: payload.description,
      location: payload.location,
      startsAt: payload.startsAt,
      reminderMinutes: payload.reminderMinutes,
      category: payload.category,
      featured: payload.featured,
    };

    const optimistic = normalizeDashboard({
      ...data,
      events: [optimisticEvent, ...data.events],
    });

    await persistContent(optimistic);

    const response = await safeJsonFetch<{ ok?: boolean; posts?: ChurchPost[]; events?: ChurchEvent[] }>(
      "/api/content",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    if (response?.ok && response.posts && response.events) {
      const synced = normalizeDashboard({
        posts: response.posts,
        events: response.events,
        subscriptions: data.subscriptions,
      });
      await persistContent(synced);
      pushToast("Evento creado", "Se agregó al calendario y quedó listo para recordatorios.");
      void maybeNotify(payload.title, payload.description);
    } else {
      pushToast("Guardado localmente", "El evento se guardó localmente mientras conectas la base.");
      void maybeNotify(payload.title, payload.description);
    }

    setEventForm({
      title: "",
      description: "",
      location: "",
      startsAt: "",
      reminderMinutes: 60,
      category: "General",
    });
    setFeaturedEvent(true);
  };

  const handleSubscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (typeof window === "undefined" || !window.Notification) {
      pushToast("Notificaciones no disponibles", "Este navegador no expone la API de notificaciones.");
      return;
    }

    const nextPermission: NotificationPermission =
      permission === "granted"
        ? "granted"
        : await window.Notification.requestPermission().catch(() => "denied");

    setPermission(nextPermission);

    if (nextPermission !== "granted") {
      pushToast("Permiso denegado", "Sin permiso no podremos mostrar avisos en el dispositivo.");
      return;
    }

    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // The app still works without background push registration.
      }
    }

    const nextSubscription = buildSubscription(
      subscriptionForm.channel,
      subscriptionForm.allowAnonymous,
      subscriptionForm.displayName
    );
    setSubscription(nextSubscription);
    saveSubscription(nextSubscription);

    const remote = await safeJsonFetch<{ ok?: boolean }>("/api/subscriptions", {
      method: "POST",
      body: JSON.stringify(nextSubscription),
    });

    if (remote?.ok) {
      pushToast("Suscripción activa", "El dispositivo quedó registrado para avisos y recordatorios.");
    } else {
      pushToast("Suscripción local", "Queda listo en el navegador; conecta la base para sincronizarlo.");
    }
  };

  const nextMonth = () => {
    setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const previousMonth = () => {
    setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  return (
    <div className="shell">
      <div className="grain" aria-hidden="true" />
      <a className="skipLink" href="#dashboard">
        Saltar al contenido
      </a>

      <main className="page">
        <section className="frame" id="dashboard">
          <div className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Plataforma de comunicación para iglesia</p>
              <h1>Noticias, calendario y notificaciones en una sola experiencia.</h1>
              <p className={styles.lead}>
                El equipo administrativo publica anuncios o noticias, crea eventos, y los usuarios
                reciben recordatorios incluso sin cuenta, siempre que tengan la PWA instalada y el
                permiso activo.
              </p>

              <div className={styles.heroActions}>
                <a className={styles.primaryAction} href="#admin">
                  Ir al panel
                </a>
                <a className={styles.secondaryAction} href="#calendario">
                  Ver calendario
                </a>
              </div>

              <ul className={styles.pills} aria-label="Capacidades principales">
                <li>Publicaciones con prioridad</li>
                <li>Eventos con recordatorio</li>
                <li>PWA lista para instalar</li>
                <li>Base Vercel Postgres preparada</li>
              </ul>
            </div>

            <aside className={styles.statusPanel} aria-label="Estado del sistema">
              <div className={styles.statusBadgeRow}>
                <span className={styles.statusBadge}>{dbReady ? "DB lista" : "Modo local"}</span>
                <span className={styles.statusBadgeAlt}>
                  {dbMode === "remote" ? "Sincronizado" : "Sin conexión a BD"}
                </span>
                <span className={styles.statusBadgeAlt}>
                  {isAdmin ? `Admin: ${adminEmail ?? "activo"}` : "Admin: no autenticado"}
                </span>
              </div>

              <div className={styles.statusMetric}>
                <strong>{totalPosts}</strong>
                <span>Publicaciones activas</span>
              </div>
              <div className={styles.statusMetric}>
                <strong>{totalEvents}</strong>
                <span>Eventos programados</span>
              </div>
              <div className={styles.statusMetric}>
                <strong>{totalSubscribers}</strong>
                <span>Suscripciones registradas</span>
              </div>

              <div className={styles.subscriptionCard}>
                <p className="mono">NOTIFICACIONES</p>
                <h3>{permission === "granted" ? "Permiso concedido" : "Pendiente de permiso"}</h3>
                <p>
                  La app puede registrar el dispositivo para notificar eventos y publicaciones
                  aunque no exista una cuenta formal.
                </p>
                <p className={styles.integrationNote}>
                  {subscription
                    ? `Última suscripción: ${subscription.displayName}`
                    : "Todavía no hay un dispositivo suscrito en este navegador."}
                </p>
              </div>
            </aside>
          </div>

          <div className={styles.metricsGrid}>
            <StatCard
              label="Cobertura"
              value="PWA instalada"
              description="Acceso directo desde navegador con icono, manifest y service worker."
            />
            <StatCard
              label="Contenido"
              value="Noticias + publicidad"
              description="El feed distingue entre anuncios internos y noticias institucionales."
            />
            <StatCard
              label="Alertas"
              value="Eventos y recordatorios"
              description="Se puede notificar a usuarios con o sin cuenta, según permisos."
            />
          </div>

          <div className={styles.dashboardGrid}>
            <section className={styles.feedSection} aria-labelledby="feed-title">
              <SectionHeader
                eyebrow="Feed"
                title="Últimas publicaciones"
                copy="Noticias y publicidad institucional ordenadas por relevancia y fecha."
              />

              <div className={styles.feedList}>
                {highlightedPosts.map((post) => (
                  <article
                    key={post.id}
                    className={`${styles.feedCard} ${post.featured ? styles.featuredCard : ""}`}
                  >
                    <div className={styles.cardTopline}>
                      <span className={styles.cardType}>
                        {post.kind === "news" ? "Noticia" : "Publicidad"}
                      </span>
                      <span className={styles.cardAudience}>{post.audience}</span>
                    </div>
                    <h3>{post.title}</h3>
                    <p>{post.summary}</p>
                    <div className={styles.cardMeta}>
                      <span>{formatDateTime(post.publishedAt)}</span>
                      {post.featured ? <span className={styles.featuredTag}>Destacado</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.calendarSection} id="calendario" aria-labelledby="calendar-title">
              <div className={styles.calendarHeader}>
                <SectionHeader
                  eyebrow="Calendario"
                  title="Agenda mensual"
                  copy="Cada evento queda visible para consultas posteriores y futuras programaciones."
                />

                <div className={styles.calendarControls}>
                  <button type="button" className={styles.calendarButton} onClick={previousMonth}>
                    Anterior
                  </button>
                  <button type="button" className={styles.calendarButton} onClick={nextMonth}>
                    Siguiente
                  </button>
                </div>
              </div>

              <div className={styles.calendarFrame}>
                <div className={styles.calendarMonthTitle}>{formatMonthTitle(activeMonth)}</div>
                <div className={styles.weekdays} aria-hidden="true">
                  {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className={styles.calendarGrid}>
                  {calendarDays.map(({ day, events }, index) => (
                    <div
                      key={`${day?.toISOString() ?? "empty"}-${index}`}
                      className={`${styles.calendarCell} ${day ? "" : styles.calendarCellEmpty}`}
                    >
                      {day ? (
                        <>
                          <span className={styles.calendarNumber}>{day.getDate()}</span>
                          {events.slice(0, 2).map((event) => (
                            <span key={event.id} className={styles.calendarChip}>
                              {event.title}
                            </span>
                          ))}
                          {events.length > 2 ? (
                            <span className={styles.calendarChipMore}>
                              +{events.length - 2} más
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className={styles.dashboardGridSecondary}>
            <section className={styles.timelineSection} aria-labelledby="agenda-title">
              <SectionHeader
                eyebrow="Próximos pasos"
                title="Eventos programados"
                copy="Lista de eventos que se pueden notificar automáticamente a usuarios instalados."
              />

              <div className={styles.timelineList}>
                {upcomingEvents.map((event) => (
                  <article key={event.id} className={styles.timelineCard}>
                    <div>
                      <span className={styles.timelineDate}>{formatDate(event.startsAt)}</span>
                      <h3>{event.title}</h3>
                    </div>
                    <p>{event.description}</p>
                    <div className={styles.timelineMeta}>
                      <span>{event.location}</span>
                      <span>{event.category}</span>
                      <span>Recordatorio {event.reminderMinutes} min antes</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.adminSection} id="admin" aria-labelledby="admin-title">
              <SectionHeader
                eyebrow="Administración"
                title="Crear contenido"
                copy="Panel para que los administradores publiquen noticias o creen eventos."
              />
              {!isAdmin ? (
                <div className={styles.adminLocked}>
                  <p>
                    Debes iniciar sesión como administrador para publicar noticias o crear eventos.
                  </p>
                  <form className={styles.formCard} onSubmit={handleAdminLogin}>
                    <label>
                      Correo
                      <input
                        value={adminLogin.email}
                        onChange={(event) =>
                          setAdminLogin({ ...adminLogin, email: event.target.value })
                        }
                        placeholder="admin@iglesia.local"
                      />
                    </label>
                    <label>
                      Contraseña
                      <input
                        type="password"
                        value={adminLogin.password}
                        onChange={(event) =>
                          setAdminLogin({ ...adminLogin, password: event.target.value })
                        }
                        placeholder="admin1234"
                      />
                    </label>
                    <button className={styles.submitButton} type="submit">
                      Entrar como admin
                    </button>
                    <a className={styles.secondaryAction} href="/login" style={{ justifyContent: "center" }}>
                      Abrir página de acceso
                    </a>
                  </form>
                </div>
              ) : (
                <>
                  <div className={styles.adminBar}>
                    <span className={styles.statusBadge}>Sesión activa</span>
                    <button type="button" className={styles.calendarButton} onClick={handleAdminLogout}>
                      Cerrar sesión
                    </button>
                  </div>
                  <div className={styles.toggleRow}>
                    {postKinds.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={`${styles.toggleButton} ${
                          contentKind === item.value ? styles.toggleButtonActive : ""
                        }`}
                        onClick={() => setContentKind(item.value)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <form className={styles.formCard} onSubmit={handlePostSubmit}>
                    <label>
                      Título
                      <input
                        value={postForm.title}
                        onChange={(event) => setPostForm({ ...postForm, title: event.target.value })}
                        placeholder="Ej. Jornada de ayuda social"
                      />
                    </label>
                    <label>
                      Resumen
                      <input
                        value={postForm.summary}
                        onChange={(event) => setPostForm({ ...postForm, summary: event.target.value })}
                        placeholder="Una línea breve para el feed"
                      />
                    </label>
                    <label>
                      Contenido
                      <textarea
                        rows={5}
                        value={postForm.body}
                        onChange={(event) => setPostForm({ ...postForm, body: event.target.value })}
                        placeholder="Texto completo de la noticia o publicidad"
                      />
                    </label>
                    <div className={styles.formRow}>
                      <label>
                        Audiencia
                        <select
                          value={postForm.audience}
                          onChange={(event) =>
                            setPostForm({ ...postForm, audience: event.target.value as (typeof audiences)[number] })
                          }
                        >
                          {audiences.map((audience) => (
                            <option key={audience} value={audience}>
                              {audience}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Destacado
                        <button
                          type="button"
                          className={`${styles.switchButton} ${featuredPost ? styles.switchActive : ""}`}
                          onClick={() => setFeaturedPost((current) => !current)}
                        >
                          {featuredPost ? "Sí" : "No"}
                        </button>
                      </label>
                    </div>
                    <button className={styles.submitButton} type="submit">
                      Publicar {contentKind === "news" ? "noticia" : "publicidad"}
                    </button>
                  </form>

                  <form className={styles.formCard} onSubmit={handleEventSubmit}>
                    <h3>Nuevo evento</h3>
                    <label>
                      Título
                      <input
                        value={eventForm.title}
                        onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })}
                        placeholder="Ej. Vigilia de oración"
                      />
                    </label>
                    <label>
                      Descripción
                      <textarea
                        rows={4}
                        value={eventForm.description}
                        onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })}
                        placeholder="Qué pasará en el evento"
                      />
                    </label>
                    <label>
                      Lugar
                      <input
                        value={eventForm.location}
                        onChange={(event) => setEventForm({ ...eventForm, location: event.target.value })}
                        placeholder="Auditorio principal"
                      />
                    </label>
                    <div className={styles.formRow}>
                      <label>
                        Fecha y hora
                        <input
                          type="datetime-local"
                          value={eventForm.startsAt}
                          onChange={(event) => setEventForm({ ...eventForm, startsAt: event.target.value })}
                        />
                      </label>
                      <label>
                        Recordatorio
                        <select
                          value={eventForm.reminderMinutes}
                          onChange={(event) =>
                            setEventForm({
                              ...eventForm,
                              reminderMinutes: Number(event.target.value),
                            })
                          }
                        >
                          <option value={15}>15 min</option>
                          <option value={60}>1 hora</option>
                          <option value={120}>2 horas</option>
                          <option value={1440}>1 día</option>
                        </select>
                      </label>
                    </div>
                    <div className={styles.formRow}>
                      <label>
                        Categoría
                        <input
                          value={eventForm.category}
                          onChange={(event) => setEventForm({ ...eventForm, category: event.target.value })}
                          placeholder="Oración, servicio, formación..."
                        />
                      </label>
                      <label>
                        Destacado
                        <button
                          type="button"
                          className={`${styles.switchButton} ${featuredEvent ? styles.switchActive : ""}`}
                          onClick={() => setFeaturedEvent((current) => !current)}
                        >
                          {featuredEvent ? "Sí" : "No"}
                        </button>
                      </label>
                    </div>
                    <button className={styles.submitButton} type="submit">
                      Crear evento
                    </button>
                  </form>
                </>
              )}
            </section>

            <section className={styles.subscriptionSection} aria-labelledby="subscribe-title">
              <SectionHeader
                eyebrow="Notificaciones"
                title="Activar avisos del dispositivo"
                copy="Usuarios sin cuenta pueden recibir avisos mientras tengan la PWA instalada."
              />

              <form className={styles.formCard} onSubmit={handleSubscribe}>
                <label>
                  Nombre visible
                  <input
                    value={subscriptionForm.displayName}
                    onChange={(event) =>
                      setSubscriptionForm({ ...subscriptionForm, displayName: event.target.value })
                    }
                    placeholder="Dispositivo anónimo"
                  />
                </label>
                <div className={styles.formRow}>
                  <label>
                    Canal
                    <select
                      value={subscriptionForm.channel}
                      onChange={(event) =>
                        setSubscriptionForm({
                          ...subscriptionForm,
                          channel: event.target.value as NotificationChannel,
                        })
                      }
                    >
                      <option value="push">Solo push</option>
                      <option value="push-email">Push + email</option>
                    </select>
                  </label>
                  <label>
                    Permitir anónimo
                    <button
                      type="button"
                      className={`${styles.switchButton} ${subscriptionForm.allowAnonymous ? styles.switchActive : ""}`}
                      onClick={() =>
                        setSubscriptionForm({
                          ...subscriptionForm,
                          allowAnonymous: !subscriptionForm.allowAnonymous,
                        })
                      }
                    >
                      {subscriptionForm.allowAnonymous ? "Sí" : "No"}
                    </button>
                  </label>
                </div>
                <div className={styles.topicList}>
                  {notificationTopics.map((topic) => (
                    <span key={topic} className={styles.topicChip}>
                      {topic}
                    </span>
                  ))}
                </div>
                <button className={styles.submitButton} type="submit">
                  {permission === "granted" ? "Reforzar suscripción" : "Solicitar permiso y registrar"}
                </button>
              </form>

              <div className={styles.integrationCard}>
                <h3>Base recomendada</h3>
                <p>
                  La app ya queda preparada para usar Vercel Postgres desde las rutas API. Si luego
                  prefieres una opción nueva, Neon es la alternativa natural porque Vercel Postgres
                  hoy se apoya en esa capa.
                </p>
                <p className={styles.integrationNote}>
                  Modo actual: {dbReady ? "conectable a BD" : "lista para modo local y posterior conexión"}
                </p>
              </div>
            </section>
          </div>
        </section>
      </main>

      {toast ? (
        <div className={styles.toast} role="status" aria-live="polite">
          <strong>{toast.title}</strong>
          <span>{toast.message}</span>
        </div>
      ) : null}
    </div>
  );
}
