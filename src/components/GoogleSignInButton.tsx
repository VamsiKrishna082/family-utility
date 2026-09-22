"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import styles from "@/app/signin/signin.module.css";

/**
 * Lives inside the server-actioned <form action={signIn(...)}> in the signin
 * page. useFormStatus gives real pending state for that form (Auth.js does a
 * full-page redirect to Google, not a popup, so this pending window is short
 * — just long enough for the button label and the portrait to react).
 */
export function GoogleSignInButton() {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (pending) window.dispatchEvent(new Event("portrait:loosen"));
  }, [pending]);

  return (
    <button className={styles.google} type="submit" aria-busy={pending} disabled={pending}>
      <svg className={styles.g} viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6C12.4 13.6 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z" />
        <path fill="#FBBC05" d="M10.5 28.8c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.7 10.8l7.8-6z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.7l-7.8 6C6.6 42.6 14.6 48 24 48z" />
      </svg>
      <span>{pending ? "Signing in…" : "Continue with Google"}</span>
    </button>
  );
}
