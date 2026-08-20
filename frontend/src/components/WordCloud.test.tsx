import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WordCloud } from "./charts";

describe("WordCloud", () => {
  it("renders keyword counts without a third-party chart plugin", () => {
    render(<WordCloud data={[{ word: "数据库", count: 12 }, { word: "解密", count: 4 }]} />);

    expect(screen.getByRole("img", { name: "高频关键词词云，共 2 个关键词" })).toBeVisible();
    expect(screen.getByText("数据库")).toHaveAttribute("title", "数据库：12");
    expect(screen.getByText("解密")).toBeVisible();
  });
});
