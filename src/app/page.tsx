import { ChurchDashboard } from "@/components/church-dashboard";

export default function Home() {
  const dbReady = Boolean(
    process.env.POSTGRES_URL ||
      process.env.VERCEL_POSTGRES_URL ||
      process.env.DATABASE_URL
  );

  return <ChurchDashboard dbReady={dbReady} />;
}
