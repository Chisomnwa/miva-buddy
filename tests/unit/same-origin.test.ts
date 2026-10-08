import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "@/lib/same-origin";

describe("same-origin request validation", () => {
  it("uses the public Host header when the server URL is an internal origin", () => {
    const request = new Request("http://internal-proxy/api/learn", {
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
      },
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("honors forwarded HTTPS and rejects foreign or absent origins", () => {
    const secureRequest = new Request("http://internal-proxy/api/learn", {
      headers: {
        host: "miva.example",
        "x-forwarded-proto": "https",
        origin: "https://miva.example",
      },
    });
    const foreignRequest = new Request("http://internal-proxy/api/learn", {
      headers: { host: "miva.example", origin: "https://attacker.example" },
    });
    const missingOrigin = new Request("http://internal-proxy/api/learn", {
      headers: { host: "miva.example" },
    });
    expect(isSameOriginRequest(secureRequest)).toBe(true);
    expect(isSameOriginRequest(foreignRequest)).toBe(false);
    expect(isSameOriginRequest(missingOrigin)).toBe(false);
  });
});
