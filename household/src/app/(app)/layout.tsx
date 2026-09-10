import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Rail } from "@/components/Rail";
import { TopBar } from "@/components/TopBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin");

  return (
    <div style={{ minHeight: "100vh" }}>
      <Rail />
      <div className="md:pl-20">
        <TopBar email={email} />
        <main className="px-5 md:px-10 py-8 md:py-10">
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
