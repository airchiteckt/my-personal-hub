import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjectsTasksSection } from "@/components/enterprise/ProjectsTasksSection";

const h = vi.hoisted(() => ({
  projects: [
    { id: "p1", name: "Lancio nuovo sito", type: "strategic", enterpriseId: "e1" },
    { id: "p2", name: "Amministrazione & Contabilità", type: "operational", enterpriseId: "e1" },
    { id: "p3", name: "Compliance & Sicurezza", type: "maintenance", enterpriseId: "e1" },
  ],
}));

vi.mock("@/context/PrpContext", () => ({
  usePrp: () => ({
    getProjectsForEnterprise: () => h.projects,
    getTasksForProject: () => [],
    completeTask: vi.fn(),
    deleteTask: vi.fn(),
    deleteProject: vi.fn(),
    addProject: vi.fn(),
    prioritySettings: {},
  }),
}));

const props = {
  enterpriseId: "e1",
  enterpriseType: "local_physical",
  hasActiveFocus: true,
  onCreateProject: vi.fn(),
  onCreateTask: vi.fn(),
  onEditProject: vi.fn(),
  onEditTask: vi.fn(),
};

beforeEach(() => {
  h.projects = [
    { id: "p1", name: "Lancio nuovo sito", type: "strategic", enterpriseId: "e1" },
    { id: "p2", name: "Amministrazione & Contabilità", type: "operational", enterpriseId: "e1" },
    { id: "p3", name: "Compliance & Sicurezza", type: "maintenance", enterpriseId: "e1" },
  ];
});

describe("Elenco progetti", () => {
  it("non mostra mai i termini inglesi dei tipi", () => {
    render(<ProjectsTasksSection {...(props as any)} />);
    expect(screen.queryByText(/Strategic|Operational|Maintenance/)).toBeNull();
  });

  it("unisce operativi e di manutenzione nel conteggio di Gestione", () => {
    render(<ProjectsTasksSection {...(props as any)} />);
    const tab = screen
      .getAllByText("Gestione")
      .find(el => el.closest("button")?.textContent?.includes("2"));
    expect(tab).toBeTruthy();
    fireEvent.click(tab!.closest("button")!);
    expect(screen.queryByText("Lancio nuovo sito")).toBeNull();
    expect(screen.getByText("Amministrazione & Contabilità")).toBeInTheDocument();
    expect(screen.getByText("Compliance & Sicurezza")).toBeInTheDocument();
  });

  it("etichetta i progetti con Crescita e Gestione", () => {
    render(<ProjectsTasksSection {...(props as any)} />);
    expect(screen.getAllByText("Crescita").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Gestione").length).toBeGreaterThanOrEqual(3);
  });
});
