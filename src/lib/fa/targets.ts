import type { FaActivity, FaSex } from "@/lib/fa/types";

/** Mifflin-St Jeor resting energy. */
export function bmr({ weightKg, heightCm, age, sex }: { weightKg: number; heightCm: number; age: number; sex: FaSex }): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

export const ACTIVITY_FACTORS = [
  { value: 1.2, label: "Mostly sitting" },
  { value: 1.375, label: "Lightly active" },
  { value: 1.55, label: "Moderately active" },
  { value: 1.725, label: "Very active" },
] as const;

export const DEFAULT_DEFICIT_PCT = 15;
export const MAX_DEFICIT_PCT = 20;

export type TargetInput = {
  weightKg: number;
  heightCm: number;
  birthYear: number;
  sex: FaSex;
  activityFactor: number;
  deficitPct: number;
  manualTargetKcal?: number;
  proteinG?: number;
  fibreG?: number;
};

export type TargetResult = {
  bmrKcal: number;
  maintenanceKcal: number;
  deficitPct: number;
  targetKcal: number;
  /** True when a typed target was below the floor and got raised to it — the UI shows a plain doctor/dietitian note. */
  flooredManual: boolean;
  proteinG: number;
  fibreG: number;
  fatG: number;
  carbsG: number;
};

/**
 * Targets with floors (food.md): the deficit is capped at 20% of
 * maintenance, and the daily target never goes below BMR — a typed target
 * lower than that is raised back to the floor rather than accepted.
 * Protein defaults to 1.6 g/kg, fibre 30 g, fat at least 0.8 g/kg (or 25% of
 * calories if that's more), carbs fill the rest.
 */
export function computeTargets(input: TargetInput, now = new Date()): TargetResult {
  const age = Math.max(15, now.getFullYear() - input.birthYear);
  const bmrKcal = Math.round(bmr({ weightKg: input.weightKg, heightCm: input.heightCm, age, sex: input.sex }));
  const maintenanceKcal = Math.round(bmrKcal * input.activityFactor);
  const deficitPct = Math.min(MAX_DEFICIT_PCT, Math.max(0, input.deficitPct));
  const byDeficit = Math.round(maintenanceKcal * (1 - deficitPct / 100));
  const deficitFloor = Math.round(maintenanceKcal * (1 - MAX_DEFICIT_PCT / 100));
  const floor = Math.max(bmrKcal, deficitFloor);

  let targetKcal = Math.max(byDeficit, bmrKcal);
  let flooredManual = false;
  if (input.manualTargetKcal) {
    if (input.manualTargetKcal < floor) {
      targetKcal = floor;
      flooredManual = true;
    } else {
      targetKcal = Math.round(input.manualTargetKcal);
    }
  }

  const proteinG = Math.round(input.proteinG ?? input.weightKg * 1.6);
  const fibreG = Math.round(input.fibreG ?? 30);
  const fatG = Math.round(Math.max(input.weightKg * 0.8, (targetKcal * 0.25) / 9));
  const carbsG = Math.max(0, Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4));
  return { bmrKcal, maintenanceKcal, deficitPct, targetKcal, flooredManual, proteinG, fibreG, fatG, carbsG };
}

/** MET values for the manual workout picker. Burned = (MET − 1) × kg × hours, i.e. calories above resting. */
export const ACTIVITY_MET: Record<FaActivity, number> = {
  walk: 4.3, run: 9, cycle: 7, strength: 5, yoga: 2.8, sport: 7, other: 4.5,
};

/**
 * An estimate, shown as one: steps at ~0.5 kcal per kg per 1,000 steps
 * (≈35 kcal per 1,000 steps at 70 kg), plus workout minutes at the activity's
 * MET. Walking in a workout and the step count can overlap; that's accepted
 * rather than asking people to split them.
 */
export function burnedKcal({ steps, workoutMin, activity, weightKg }: { steps: number; workoutMin: number; activity?: FaActivity; weightKg: number }): number {
  const fromSteps = (steps / 1000) * 0.5 * weightKg;
  const met = ACTIVITY_MET[activity ?? "other"];
  const fromWorkout = (met - 1) * weightKg * (workoutMin / 60);
  return Math.round(fromSteps + fromWorkout);
}
