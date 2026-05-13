import { sql } from "@vercel/postgres";
import type {
  ChurchEvent,
  ChurchPost,
  DashboardSeed,
  NotificationChannel,
  NotificationSubscription,
} from "@/lib/church-data";
import {
  createId,
  isContentKind,
  isNotificationChannel,
  seedDashboard,
  sortEvents,
  sortPosts,
} from "@/lib/church-data";

const tableScripts = [
  () =>
    sql`CREATE TABLE IF NOT EXISTS church_posts (
      id text PRIMARY KEY,
      kind text NOT NULL,
      title text NOT NULL,
      summary text NOT NULL,
      body text NOT NULL,
      audience text NOT NULL,
      featured boolean NOT NULL DEFAULT false,
      published_at timestamptz NOT NULL DEFAULT now()
    )`,
  () =>
    sql`CREATE TABLE IF NOT EXISTS church_events (
      id text PRIMARY KEY,
      title text NOT NULL,
      description text NOT NULL,
      location text NOT NULL,
      starts_at timestamptz NOT NULL,
      reminder_minutes integer NOT NULL DEFAULT 60,
      category text NOT NULL,
      featured boolean NOT NULL DEFAULT false
    )`,
  () =>
    sql`CREATE TABLE IF NOT EXISTS church_subscriptions (
    id text PRIMARY KEY,
    display_name text NOT NULL,
    channel text NOT NULL,
    allow_anonymous boolean NOT NULL DEFAULT true,
    topics text NOT NULL DEFAULT '[]',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
];

function dbConfigured() {
  return Boolean(
    process.env.POSTGRES_URL ||
      process.env.VERCEL_POSTGRES_URL ||
      process.env.DATABASE_URL
  );
}

export async function ensureDatabase() {
  if (!dbConfigured()) {
    throw new Error("Database not configured");
  }

  await Promise.all(tableScripts.map((script) => script()));
}

function toPost(row: Record<string, unknown>): ChurchPost {
  const kind = isContentKind(String(row.kind)) ? (String(row.kind) as ChurchPost["kind"]) : "news";

  return {
    id: String(row.id),
    kind,
    title: String(row.title),
    summary: String(row.summary),
    body: String(row.body),
    audience: String(row.audience) as ChurchPost["audience"],
    featured: Boolean(row.featured),
    publishedAt: new Date(String(row.published_at)).toISOString(),
  };
}

function toEvent(row: Record<string, unknown>): ChurchEvent {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    location: String(row.location),
    startsAt: new Date(String(row.starts_at)).toISOString(),
    reminderMinutes: Number(row.reminder_minutes ?? 60),
    category: String(row.category),
    featured: Boolean(row.featured),
  };
}

function toSubscription(row: Record<string, unknown>): NotificationSubscription {
  let topics: string[] = [];

  if (Array.isArray(row.topics)) {
    topics = row.topics.map(String);
  } else if (typeof row.topics === "string") {
    try {
      const parsed = JSON.parse(row.topics);
      topics = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      topics = row.topics ? [String(row.topics)] : [];
    }
  }

  return {
    id: String(row.id),
    displayName: String(row.display_name),
    channel: isNotificationChannel(String(row.channel))
      ? (String(row.channel) as NotificationChannel)
      : "push",
    allowAnonymous: Boolean(row.allow_anonymous),
    topics,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function loadDashboardData() {
  await ensureDatabase();

  const [postsResult, eventsResult, subscriptionsResult] = await Promise.all([
    sql`SELECT * FROM church_posts ORDER BY published_at DESC`,
    sql`SELECT * FROM church_events ORDER BY starts_at ASC`,
    sql`SELECT * FROM church_subscriptions ORDER BY created_at DESC`,
  ]);

  if (
    postsResult.rows.length === 0 &&
    eventsResult.rows.length === 0 &&
    subscriptionsResult.rows.length === 0
  ) {
    await Promise.all([
      ...seedDashboard.posts.map((post) =>
        sql`
          INSERT INTO church_posts (id, kind, title, summary, body, audience, featured, published_at)
          VALUES (${post.id}, ${post.kind}, ${post.title}, ${post.summary}, ${post.body}, ${post.audience}, ${post.featured}, ${post.publishedAt})
          ON CONFLICT (id) DO NOTHING
        `
      ),
      ...seedDashboard.events.map((event) =>
        sql`
          INSERT INTO church_events (id, title, description, location, starts_at, reminder_minutes, category, featured)
          VALUES (${event.id}, ${event.title}, ${event.description}, ${event.location}, ${event.startsAt}, ${event.reminderMinutes}, ${event.category}, ${event.featured})
          ON CONFLICT (id) DO NOTHING
        `
      ),
      ...seedDashboard.subscriptions.map((subscription) =>
        sql`
          INSERT INTO church_subscriptions (id, display_name, channel, allow_anonymous, topics, created_at)
          VALUES (${subscription.id}, ${subscription.displayName}, ${subscription.channel}, ${subscription.allowAnonymous}, ${JSON.stringify(subscription.topics)}, ${subscription.createdAt})
          ON CONFLICT (id) DO NOTHING
        `
      ),
    ]);

    return seedDashboard as DashboardSeed;
  }

  return {
    posts: sortPosts(postsResult.rows.map(toPost)),
    events: sortEvents(eventsResult.rows.map(toEvent)),
    subscriptions: subscriptionsResult.rows.map(toSubscription),
  };
}

export async function savePost(input: Omit<ChurchPost, "id" | "publishedAt"> & {
  publishedAt?: string;
}) {
  await ensureDatabase();

  const id = createId("post");
  const publishedAt = input.publishedAt ?? new Date().toISOString();

  await sql`
    INSERT INTO church_posts (id, kind, title, summary, body, audience, featured, published_at)
    VALUES (${id}, ${input.kind}, ${input.title}, ${input.summary}, ${input.body}, ${input.audience}, ${input.featured}, ${publishedAt})
  `;

  return {
    id,
    ...input,
    publishedAt,
  } satisfies ChurchPost;
}

export async function saveEvent(input: Omit<ChurchEvent, "id">) {
  await ensureDatabase();

  const id = createId("event");

  await sql`
    INSERT INTO church_events (id, title, description, location, starts_at, reminder_minutes, category, featured)
    VALUES (${id}, ${input.title}, ${input.description}, ${input.location}, ${input.startsAt}, ${input.reminderMinutes}, ${input.category}, ${input.featured})
  `;

  return {
    id,
    ...input,
  } satisfies ChurchEvent;
}

export async function saveSubscription(input: Omit<NotificationSubscription, "id" | "createdAt"> & {
  createdAt?: string;
}) {
  await ensureDatabase();

  const id = createId("sub");
  const createdAt = input.createdAt ?? new Date().toISOString();

  await sql`
    INSERT INTO church_subscriptions (id, display_name, channel, allow_anonymous, topics, created_at)
    VALUES (${id}, ${input.displayName}, ${input.channel}, ${input.allowAnonymous}, ${JSON.stringify(input.topics)}, ${createdAt})
  `;

  return {
    id,
    ...input,
    createdAt,
  } satisfies NotificationSubscription;
}
