import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  ent: { id: "e1", name: "Ambressa", color: "220, 80%, 55%" },
  focusPeriods: [
    { id: "f1", enterpriseId: "e1", status: "active", name: "Q1 2026", startDate: "2026-01-01", endDate: "2026-03-31", description: "" },
  ],
  objectives: [{ id: "o1", focusPeriodId: "f1", title: "Crescere" }],
  keyResults: [
    { id: "k1", objectiveId: "o1", title: "Più clienti", metricType: "number", currentValue: 3, targetValue: 10 },
  ],
  projects: [
    { id: "p1", name: "Lancio nuovo sito", type: "strategic", enterpriseId: "e1", keyResultId: "k1" },
    { id: "p2", name: "Amministrazione & Contabilità", type: "operational", enterpriseId: "e1", keyResultId: null },
    { id: "p3", name: "Compliance & Sicurezza", type: "maintenance", enterpriseId: "e1", keyResultId: null },
  ],
  tasks: [],
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ enterpriseId: "e1" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/context/PrpContext", () => ({
  usePrp: () => ({
    getEnterprise: () => h.ent,
    focusPeriods: h.focusPeriods,
    objectives: h.objectives,
    keyResults: h.keyResults,
    projects: h.projects,
    tasks: h.tasks,
    deleteFocusPeriod: vi.fn(),
    deleteObjective: vi.fn(),
    deleteKeyResult: vi.fn(),
    deleteProject: vi.fn(),
  }),
}));

vi.mock("@/components/AiAssistant", () => ({ RadarEmbedded: () => null }));
vi.mock("@/components/enterprise/CreateFocusPeriodDialog", () => ({ CreateFocusPeriodDialog: () => null }));
vi.mock("@/components/enterprise/CreateObjectiveDialog", () => ({ CreateObjectiveDialog: () => null }));
vi.mock("@/components/enterprise/CreateKeyResultDialog", () => ({ CreateKeyResultDialog: () => null }));
vi.mock("@/components/CreateProjectDialog", () => ({ CreateProjectDialog: () => null }));

import EnterprisePlan from "@/pages/EnterprisePlan";

describe("Pagina impresa", () => {
  it("chiama il riquadro dei progetti non collegati Gestione ordinaria", () => {
    render(<EnterprisePlan />);
    expect(screen.getByText("Gestione ordinaria")).toBeInTheDocument();
    expect(screen.queryByText(/Progetti operativi e di manutenzione/)).toBeNull();
    expect(screen.queryByText(/Strategic|Operational|Maintenance/)).toBeNull();
  });
});
