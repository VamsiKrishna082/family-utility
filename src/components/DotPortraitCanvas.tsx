"use client";

import { useEffect, useRef } from "react";
import { DotPortrait } from "@/lib/dotPortrait";
import { PORTRAIT } from "@/lib/portraitData";

/**
 * The sign-in page's halftone portrait: dots fly in on load, shy away from
 * the pointer, and loosen while the sign-in redirect is in flight — that
 * last part is triggered by GoogleSignInButton firing the "portrait:loosen"
 * window event, since the two live in separate client islands either side
 * of the server-actioned <form> and don't otherwise share state.
 */
export function DotPortraitCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const art = new DotPortrait(canvasRef.current, PORTRAIT);
    const loosen = () => art.setMode("loose");
    window.addEventListener("portrait:loosen", loosen);
    return () => {
      window.removeEventListener("portrait:loosen", loosen);
      art.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}
