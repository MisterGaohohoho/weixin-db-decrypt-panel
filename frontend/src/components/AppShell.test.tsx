import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../lib/api";
import { AppShell } from "./AppShell";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      health: vi.fn(),
      profile: vi.fn(),
    },
  };
});

function renderShell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/overview"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="overview" element={<div data-testid="outlet-content">概览内容</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.health).mockReset();
  vi.mocked(api.profile).mockReset();
});

afterEach(() => {
  cleanup();
});

describe("AppShell health gate", () => {
  it("shows first-run setup without requesting profile data or mounting the outlet", async () => {
    vi.mocked(api.health).mockResolvedValue({
      status: "setup_required",
      configured: false,
      database_root: "D:\\snapshots\\wechat",
      report_path: "D:\\snapshots\\decryption_report.json",
      missing: ["message/message_0.db"],
    });

    renderShell();

    expect(await screen.findByRole("heading", { name: "本地数据尚未就绪" })).toBeVisible();
    expect(screen.getByText("D:\\snapshots\\wechat")).toBeVisible();
    expect(screen.queryByTestId("outlet-content")).not.toBeInTheDocument();
    expect(api.profile).not.toHaveBeenCalled();
  });

  it("requests the profile and mounts routed content only after health is ready", async () => {
    vi.mocked(api.health).mockResolvedValue({ status: "ok", configured: true, snapshot_time: "2026-08-20T10:00:00+08:00" });
    vi.mocked(api.profile).mockResolvedValue({ profile: { username: "wxid_local", display_name: "本地用户" } });

    renderShell();

    expect(await screen.findByTestId("outlet-content")).toBeVisible();
    await waitFor(() => expect(api.profile).toHaveBeenCalledOnce());
    expect(screen.queryByRole("heading", { name: "本地数据尚未就绪" })).not.toBeInTheDocument();
  });
});
