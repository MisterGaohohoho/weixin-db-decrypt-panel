import { afterEach, describe, expect, it, vi } from "vitest";

import { API_BASE, assetUrl, externalUrl, fetchApi } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API helpers", () => {
  it("uses the same-origin API prefix and keeps safe asset URLs", () => {
    expect(API_BASE).toBe("/api");
    expect(assetUrl("/api/avatars/wxid_local")).toBe("/api/avatars/wxid_local");
    expect(assetUrl("data:image/png;base64,AA==")).toBe("data:image/png;base64,AA==");
    expect(assetUrl("avatars/wxid_local")).toBe("/api/avatars/wxid_local");
    expect(externalUrl("https://example.test/path")).toBe("https://example.test/path");
    expect(externalUrl("javascript:alert(1)")).toBeUndefined();
    expect(externalUrl("file:///C:/private.txt")).toBeUndefined();
  });

  it("serializes only defined query parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchApi("/overview", { days: 30, empty: "", missing: undefined })).resolves.toEqual({ status: "ok" });
    const requestUrl = fetchMock.mock.calls[0][0] as URL;
    expect(requestUrl.pathname).toBe("/api/overview");
    expect(requestUrl.searchParams.get("days")).toBe("30");
    expect(requestUrl.searchParams.has("empty")).toBe(false);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Accept: "application/json" } });
  });

  it("surfaces FastAPI detail messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "查询参数无效" }), {
        status: 422,
        statusText: "Unprocessable Entity",
        headers: { "Content-Type": "application/json" },
      }),
    ));

    await expect(fetchApi("/search", { q: "" })).rejects.toMatchObject({ status: 422, message: "查询参数无效" });
  });
});
