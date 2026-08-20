import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EChart } from "./charts";

describe("EChart", () => {
  it("loads the ESM chart component as a valid React element", () => {
    const html = renderToString(<EChart option={{}} label="test chart" />);

    expect(html).toContain('aria-label="test chart"');
    expect(html).toContain("echarts-for-react");
  });
});
