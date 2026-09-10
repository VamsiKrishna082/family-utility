import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { auth, signIn } from "@/lib/auth";

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.email) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full" style={{ maxWidth: 360 }}>
        <div
          className="flex items-center justify-center mb-7"
          style={{ width: 52, height: 52, borderRadius: 16, background: "#fff", border: "1px solid var(--line)" }}
        >
          <Lock size={20} color="var(--amber)" />
        </div>

        <h1 className="display" style={{ fontSize: 32, lineHeight: 1.15 }}>
          Two of you live here
        </h1>
        <p style={{ color: "var(--dim)", fontSize: 14.5, marginTop: 12, lineHeight: 1.6 }}>
          The site is public. The door is not. Only the addresses on the list can get in.
        </p>

        {error && (
          <p
            className="mt-5 px-4 py-3"
            style={{ background: "#f6e8e6", color: "var(--red)", borderRadius: 12, fontSize: 13.5 }}
          >
            That account is not on the list.
          </p>
        )}

        <form
          className="mt-7"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button className="btn btn-dark w-full" style={{ padding: "13px 16px" }} type="submit">
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
