import { describe, expect, it } from "vitest";
import { CONNECTOR_CATEGORIES, CONNECTORS, connectorsIn, findConnector } from "./connectors";

describe("connector catalog", () => {
  it("has unique ids that work as URL segments", () => {
    const ids = CONNECTORS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("fills every category", () => {
    for (const category of CONNECTOR_CATEGORIES) {
      expect(connectorsIn(category.id).length).toBeGreaterThan(0);
    }
  });

  it("says how to get a CSV out exactly when CSV is the way in", () => {
    for (const c of CONNECTORS) {
      expect(Boolean("csvExport" in c && c.csvExport), c.id).toBe(c.status === "via-csv");
    }
  });

  it("brings in at least one monthly value per connector", () => {
    for (const c of CONNECTORS) expect(c.metrics.length, c.id).toBeGreaterThan(0);
  });

  it("finds connectors by id", () => {
    expect(findConnector("excel")?.name).toBe("Microsoft Excel");
    expect(findConnector("nope")).toBeUndefined();
  });
});
