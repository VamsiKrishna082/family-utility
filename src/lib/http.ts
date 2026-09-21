import { NextResponse } from "next/server";

export function ok(data: unknown) {
  return NextResponse.json(data);
}

export function fail(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Something went wrong";
  console.error("[api]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}
