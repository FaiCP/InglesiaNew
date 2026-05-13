export type ContentKind = "news" | "advertisement";
export type NotificationChannel = "push" | "push-email";
export type Audience = "Toda la iglesia" | "Jóvenes" | "Líderes" | "Voluntarios";

export interface ChurchPost {
  id: string;
  kind: ContentKind;
  title: string;
  summary: string;
  body: string;
  audience: Audience;
  featured: boolean;
  publishedAt: string;
}

export interface ChurchEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  reminderMinutes: number;
  category: string;
  featured: boolean;
}

export interface NotificationSubscription {
  id: string;
  displayName: string;
  channel: NotificationChannel;
  allowAnonymous: boolean;
  topics: string[];
  createdAt: string;
}

export interface DashboardSeed {
  posts: ChurchPost[];
  events: ChurchEvent[];
  subscriptions: NotificationSubscription[];
}

const now = new Date();
const inDays = (days: number, hours = 0) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
};

export const seedDashboard: DashboardSeed = {
  posts: [
    {
      id: "post-welcome-1",
      kind: "news",
      title: "Campaña de apoyo para familias nuevas",
      summary: "Noticias sobre la semana de bienvenida con puntos de recolección y horarios.",
      body:
        "Cada domingo tendremos un espacio de recepción en la entrada principal. Los administradores podrán actualizar este anuncio con imágenes, enlaces y llamados a la acción.",
      audience: "Toda la iglesia",
      featured: true,
      publishedAt: inDays(-2, 9),
    },
    {
      id: "post-renewal-2",
      kind: "advertisement",
      title: "Inscripciones abiertas para el curso de liderazgo",
      summary: "Publicidad interna para promover el programa de formación del trimestre.",
      body:
        "Este bloque permite anuncios de la iglesia que no son noticias, con la posibilidad de segmentar por audiencia y destacar campañas especiales.",
      audience: "Líderes",
      featured: false,
      publishedAt: inDays(-5, 17),
    },
    {
      id: "post-youth-3",
      kind: "news",
      title: "Servicio juvenil de viernes",
      summary: "La noche juvenil tendrá una programación especial con alabanza y testimonio.",
      body:
        "Los jóvenes verán este contenido en el mismo feed, pero puede priorizarse en el canal móvil si el administrador lo marca como destacado.",
      audience: "Jóvenes",
      featured: true,
      publishedAt: inDays(-1, 18),
    },
  ],
  events: [
    {
      id: "event-prayer-1",
      title: "Vigilia de oración",
      description: "Una noche completa de oración, adoración y intercesión por la comunidad.",
      location: "Auditorio principal",
      startsAt: inDays(2, 19),
      reminderMinutes: 60,
      category: "Oración",
      featured: true,
    },
    {
      id: "event-serve-2",
      title: "Jornada de servicio social",
      description: "Entrega de mercados, acompañamiento y brigada de apoyo en el barrio.",
      location: "Zona comunitaria",
      startsAt: inDays(6, 8),
      reminderMinutes: 1440,
      category: "Servicio",
      featured: false,
    },
    {
      id: "event-training-3",
      title: "Capacitación de administradores",
      description: "Taller para publicar noticias, programar eventos y configurar notificaciones.",
      location: "Sala de liderazgo",
      startsAt: inDays(9, 18),
      reminderMinutes: 120,
      category: "Formación",
      featured: true,
    },
  ],
  subscriptions: [
    {
      id: "sub-lobby",
      displayName: "Dispositivo de recepción",
      channel: "push",
      allowAnonymous: true,
      topics: ["eventos", "noticias"],
      createdAt: inDays(-12, 10),
    },
  ],
};

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function isContentKind(value: string): value is ContentKind {
  return value === "news" || value === "advertisement";
}

export function isNotificationChannel(value: string): value is NotificationChannel {
  return value === "push" || value === "push-email";
}

export function sortPosts(posts: ChurchPost[]) {
  return [...posts].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

export function sortEvents(events: ChurchEvent[]) {
  return [...events].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}
