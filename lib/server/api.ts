import { NextResponse } from "next/server";
import { ZodSchema } from "zod";

export function ok<T>(data: T) {
  return NextResponse.json(data);
}

export function forbidden(message = "Keine Berechtigung") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function unauthorized(message = "Nicht authentifiziert") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function badRequest(message = "Ungueltige Anfrage") {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function readJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const body = await request.json().catch(() => ({}));
  return schema.parse(body);
}
