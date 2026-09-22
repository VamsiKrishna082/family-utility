import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { DotPortraitCanvas } from "@/components/DotPortraitCanvas";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import styles from "./signin.module.css";

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.email) redirect("/");
  const { error } = await searchParams;

  return (
    <div className={styles.page}>
      <link
        href="https://fonts.googleapis.com/css2?family=Graduate&family=Hanken+Grotesk:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <div className={styles.rib} aria-hidden="true" />
      <main className={styles.login}>
        <div className={styles.portrait}>
          <p className={styles.caption}>18 July 2026</p>
          <div
            className={styles.art}
            role="img"
            aria-label="Halftone portrait of Vamsi and Varshini in matching jerseys"
          >
            <DotPortraitCanvas />
          </div>
        </div>

        <section className={styles.panel}>
          <h1 className={styles.title}>
            <span>Vamsi</span>
            <span className={styles.amp}>&amp;</span>
            <span>Varshini</span>
          </h1>
          <p className={styles.lede}>Our photos, money, lists and everything else we share.</p>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <GoogleSignInButton />
          </form>

          {error && <p className={styles.error} role="alert">That account is not on the list.</p>}

          <p className={styles.note}>Only our two Google accounts can sign in.</p>
        </section>
      </main>
    </div>
  );
}
