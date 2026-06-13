import { describe, it, expect } from "vitest";
import { fetchAllData } from "./data";

const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe.skipIf(!hasSupabase)("fetchAllData (live Supabase)", () => {
  it("fetches a well-formed CashflowState from the seeded database", async () => {
    const state = await fetchAllData();
    expect(state.settings.rangeStart).toBe("2025-07");
    expect(state.settings.rangeEnd).toBe("2027-03");
    expect(state.movements.length).toBeGreaterThanOrEqual(25);
    expect(state.movements.filter((m) => m.bank === "galicia")).toHaveLength(16);
    expect(state.movements.filter((m) => m.bank === "nacion")).toHaveLength(9);
    expect(state.fci.data["2025-07"]).toEqual({ suscripciones: 260000000, rescates: 260586228 });
    expect(state.projection.azucar["2025-07"]).toEqual({ cantidad: 7000, precio: 25000 });
    expect(state.iva["Azúcar"]["2025-07"]).toBe(131900826);
  });
});
