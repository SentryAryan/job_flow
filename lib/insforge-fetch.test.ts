import { describe, expect, it, vi } from "vitest";

import { createInsforgeBrowserFetch } from "@/lib/insforge-fetch";

describe("createInsforgeBrowserFetch", () => {
  it("forces cache: no-store and Cache-Control: no-store", async () => {
    const baseFetch = vi.fn(async () => new Response("{}", { status: 200 }));
    const wrapped = createInsforgeBrowserFetch(
      baseFetch as unknown as typeof fetch,
    );

    await wrapped("https://example.test/api", {
      method: "GET",
      headers: { Authorization: "Bearer x" },
    });

    expect(baseFetch).toHaveBeenCalledTimes(1);
    const [, init] = baseFetch.mock.calls[0]!;
    expect(init?.cache).toBe("no-store");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer x");
    expect(headers.get("Cache-Control")).toBe("no-store");
  });

  it("retries with cache reload when the first response is 304", async () => {
    const baseFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 304,
          headers: { ETag: '"abc"' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "1" }), { status: 200 }),
      );

    const wrapped = createInsforgeBrowserFetch(
      baseFetch as unknown as typeof fetch,
    );
    const res = await wrapped("https://example.test/profiles");

    expect(res.status).toBe(200);
    expect(baseFetch).toHaveBeenCalledTimes(2);
    expect(baseFetch.mock.calls[1]![1]?.cache).toBe("reload");
  });
});