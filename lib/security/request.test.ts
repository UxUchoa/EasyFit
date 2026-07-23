import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { hasTrustedOrigin } from "./request";

const previousAppUrl = process.env.APP_URL;
const previousAllowedOrigins = process.env.ALLOWED_ORIGINS;

afterEach(() => {
  if (previousAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = previousAppUrl;
  if (previousAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
  else process.env.ALLOWED_ORIGINS = previousAllowedOrigins;
});

describe("trusted mutation origins", () => {
  it("allows safe requests without an Origin header", () => {
    expect(hasTrustedOrigin(new NextRequest("https://easyfit.test/api/value", { method: "GET" }))).toBe(true);
  });

  it("rejects mutations without an Origin header", () => {
    expect(hasTrustedOrigin(new NextRequest("https://easyfit.test/api/value", { method: "POST" }))).toBe(false);
  });

  it("accepts same-origin mutations without deployment-specific configuration", () => {
    delete process.env.APP_URL;
    delete process.env.ALLOWED_ORIGINS;
    expect(hasTrustedOrigin(new NextRequest("https://easy-fit-phi.vercel.app/api/value", {
      method: "POST",
      headers: { origin: "https://easy-fit-phi.vercel.app" },
    }))).toBe(true);
  });

  it("accepts configured canonical and preview origins but rejects others", () => {
    process.env.APP_URL = "https://easyfit.example";
    process.env.ALLOWED_ORIGINS = "https://preview.easyfit.example";
    expect(hasTrustedOrigin(new NextRequest("https://internal.test/api/value", { method: "POST", headers: { origin: "https://easyfit.example" } }))).toBe(true);
    expect(hasTrustedOrigin(new NextRequest("https://internal.test/api/value", { method: "POST", headers: { origin: "https://preview.easyfit.example" } }))).toBe(true);
    expect(hasTrustedOrigin(new NextRequest("https://internal.test/api/value", { method: "POST", headers: { origin: "https://attacker.example" } }))).toBe(false);
  });
});
