import { describe, it, expect } from "vitest";
import { PROJECT_TYPE_LABELS, PROJECT_FAMILY_LABELS, projectFamily } from "../types/prp";

describe("Nomi dei tipi di progetto", () => {
  it("usa Crescita e Gestione, mai i termini inglesi", () => {
    expect(PROJECT_TYPE_LABELS.strategic).toBe("Crescita");
    expect(PROJECT_TYPE_LABELS.operational).toBe("Gestione");
    expect(PROJECT_TYPE_LABELS.maintenance).toBe("Gestione");
    expect(Object.values(PROJECT_TYPE_LABELS).join(" ")).not.toMatch(/Strategic|Operational|Maintenance/i);
  });

  it("raggruppa operativi e di manutenzione nella famiglia Gestione", () => {
    expect(projectFamily("strategic")).toBe("crescita");
    expect(projectFamily("operational")).toBe("gestione");
    expect(projectFamily("maintenance")).toBe("gestione");
    expect(PROJECT_FAMILY_LABELS.crescita).toBe("Crescita");
    expect(PROJECT_FAMILY_LABELS.gestione).toBe("Gestione");
  });
});
