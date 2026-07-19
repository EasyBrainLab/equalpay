import { ok } from "@/lib/server/api";

export async function GET() {
  return ok({ status: "ok", service: "ez-pay-transparency-suite" });
}
