import type { NextRequest } from "next/server";
import { sessionUser } from "./store";
import type { State, Grant, Project } from "./model";
import { can, grantFor } from "./model";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(code: number, message: string): never {
  throw new ApiError(code, message);
}
export function str(
  value: unknown,
  name: string,
  max = 3000,
  required = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    fail(422, `Enter a valid ${name}.`);
  return value.trim();
}
export function date(value: unknown) {
  const v = str(value, "due date", 10);
  if (
    v &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
      Number.isNaN(Date.parse(v)) ||
      new Date(v).toISOString().slice(0, 10) !== v)
  )
    fail(422, "Use a valid due date.");
  return v;
}
export function project(
  s: State,
  id: string,
  user: string,
  level: Grant = "View",
): Project {
  const p = s.projects.find((p) => p.id === id);
  if (!p || !grantFor(s, user, p)) fail(404, "This project is unavailable.");
  if (!can(s, user, p, level))
    fail(403, `You need ${level.toLowerCase()} access for this action.`);
  if (p.archived && level !== "View")
    fail(403, "Archived project is read-only.");
  return p;
}
export function task(
  s: State,
  id: string,
  user: string,
  level: Grant = "View",
) {
  const t = s.tasks.find((t) => t.id === id);
  if (!t) fail(404, "This task is unavailable.");
  project(s, t.projectId, user, level);
  if (t.deletedAt) fail(404, "This task is in the trash or unavailable.");
  return t;
}
export function document(
  s: State,
  id: string,
  user: string,
  level: Grant = "View",
) {
  const d = s.documents?.find((d) => d.id === id);
  if (!d) fail(404, "This document is unavailable.");
  project(s, d.projectId, user, level);
  return d;
}
export function requestActor(req: NextRequest, write = false) {
  if (process.env.RELAYWORK_DEMO !== "1")
    fail(503, "Local demonstration is not enabled.");
  if (write) {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host"))
      fail(403, "Request origin is not allowed.");
  }
  const actor = sessionUser(req.cookies.get("relaywork_session")?.value || "");
  if (!actor) fail(401, "Your session expired. Reload the app.");
  return actor;
}
