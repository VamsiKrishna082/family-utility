/**
 * How to install the app on this device — pure, tested in
 * scripts/install.test.mjs. Browsers only offer a one-tap install prompt
 * sometimes (and iPhones never), so the card always has written steps to
 * fall back on.
 */
export type InstallHow =
  | { kind: "in-app"; app: string }
  | { kind: "ios"; browser: "safari" | "other" }
  | { kind: "android"; browser: "chrome" | "samsung" | "firefox" | "other" }
  | { kind: "desktop" };

export function installHow(ua: string, maxTouchPoints = 0): InstallHow {
  const inApp = /(FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|LinkedInApp|GSA\/)/i.exec(ua);
  if (inApp) return { kind: "in-app", app: /whatsapp/i.test(inApp[1]) ? "WhatsApp" : /instagram/i.test(inApp[1]) ? "Instagram" : /fb/i.test(inApp[1]) ? "Facebook" : /gsa/i.test(inApp[1]) ? "the Google app" : "this app" };
  // iPadOS reports itself as a Mac; a touch screen gives it away.
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1);
  if (ios) return { kind: "ios", browser: /crios|fxios|edgios|opios/i.test(ua) ? "other" : "safari" };
  if (/android/i.test(ua)) {
    if (/samsungbrowser/i.test(ua)) return { kind: "android", browser: "samsung" };
    if (/firefox/i.test(ua)) return { kind: "android", browser: "firefox" };
    if (/chrome/i.test(ua)) return { kind: "android", browser: "chrome" };
    return { kind: "android", browser: "other" };
  }
  return { kind: "desktop" };
}

/** The written steps for a device, when there's no one-tap prompt. */
export function installSteps(how: InstallHow): string {
  switch (how.kind) {
    case "in-app":
      return `You're inside ${how.app}'s browser, which can't install apps. Tap ⋯ and choose “Open in browser” (Chrome or Safari), then install from there.`;
    case "ios":
      return how.browser === "safari"
        ? "Tap the Share button (square with an arrow), scroll down and tap “Add to Home Screen”, then “Add”."
        : "Tap the Share button, then “Add to Home Screen” (iOS 16.4 or later). If you don't see it, open this page in Safari and do it there.";
    case "android":
      return how.browser === "samsung"
        ? "Tap the menu (☰) at the bottom, then “Add page to” → “Home screen”."
        : how.browser === "firefox"
          ? "Tap the menu (⋮), then “Install”."
          : "Tap the menu (⋮) at the top right, then “Install app” or “Add to Home screen”.";
    case "desktop":
      return "In Chrome or Edge, click the install icon at the right end of the address bar.";
  }
}
