
-- Add strategic fields to enterprises
ALTER TABLE public.enterprises
  ADD COLUMN strategic_importance integer NOT NULL DEFAULT 3,
  ADD COLUMN growth_potential integer NOT NULL DEFAULT 3,
  ADD COLUMN phase text NOT NULL DEFAULT 'setup',
  ADD COLUMN priority_until date DEFAULT NULL;

-- Add constraints
ALTER TABLE public.enterprises
  ADD CONSTRAINT enterprises_strategic_importance_check CHECK (strategic_importance BETWEEN 1 AND 5),
  ADD CONSTRAINT enterprises_growth_potential_check CHECK (growth_potential BETWEEN 1 AND 5),
  ADD CONSTRAINT enterprises_phase_check CHECK (phase IN ('idea', 'setup', 'launch', 'scaling', 'stable'));
