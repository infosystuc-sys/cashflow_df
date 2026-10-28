import { describe, it, expect } from "vitest";
import { fetchAllData } from "./data";

const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe.skipIf(!hasSupabase)("fetchAllData (live Supabase)", () => {
  it("fetches a well-formed DbState from the seeded database", async () => {
    const db = await fetchAllData();
    expect(db.rangeStart).toBe("2025-07");
    expect(db.rangeEnd).toBe("2027-03");
    expect(db.empresas.map((e) => e.id)).toEqual(["san", "sas"]);
    expect(db.banks.find((b) => b.id === "galicia")?.label).toBe("SAN Galicia");
    expect(db.movements.length).toBeGreaterThanOrEqual(25);
    expect(db.movements.filter((m) => m.bank === "galicia")).toHaveLength(16);
    expect(db.movements.filter((m) => m.bank === "nacion")).toHaveLength(9);
    expect(db.fci.san["2025-07"]).toEqual({ suscripciones: 260000000, rescates: 260586228 });
    expect(db.projection.san.azucar["2025-07"]).toEqual({ cantidad: 7000, precio: 25000 });
    expect(db.iva.san["Azúcar"]["2025-07"]).toBe(131900826);
  });
});
