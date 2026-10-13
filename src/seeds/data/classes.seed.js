"use strict";

/**
 * TSW Master Reusable Programs Seed Data
 * Reference data containing the 15 standard TSW programs with Beginner and Intermediate workouts.
 */
const SEED_CLASSES = [
  {
    id: "CLS-001",
    name: "Push, Legs, Pull",
    beginnerWorkouts: "Not specified",
    intermediateWorkouts:
      "Push: Push ups 5–10 × 3; Dips 4–10 × 3; OH Press 6–10 × 3. Legs: GB Squats 8–10 × 3; Deadlift 6–10 × 3; Calf Raises 15–20 × 3; Step Ups 6–10 × 3. Pull: Hori Pulls 6–10 × 3; Lateral Pull down 6–8 × 3; Bent over rows 6–10 × 3.",
    status: "ACTIVE",
  },
  {
    id: "CLS-002",
    name: "EMOM",
    beginnerWorkouts:
      "8 mins: Pull-ups, Push ups, Deadlifts. E2MOM (10 mins): Elbow plank 30s/30s Rest; Hollow body 30s/30s Rest. Alternate bicep curls 10 × 3; OH Tricep Extensions 6–8 × 3.",
    intermediateWorkouts:
      "EMOM (10 mins each): Swings 15–20 + Farmer's Carry 30–40s; Pull ups 2–6 + Deadhang 30s; Squats 6–10 + Ape Hops 30s; Push ups/Dips 4–6 + Goblet Carry 30s.",
    status: "ACTIVE",
  },
  {
    id: "CLS-003",
    name: "5×5",
    beginnerWorkouts: "Not specified",
    intermediateWorkouts:
      "Push ups/Plate Press/OH Press; Squats; Deadlift; Pulls.",
    status: "ACTIVE",
  },
  {
    id: "CLS-004",
    name: "Circuit Training",
    beginnerWorkouts:
      "1 min Skipping; 1 min Elbow Plank; 10 Goblet Squats; 30s Ape Hops; 30s Lateral Bear Crawl; 60s Wall Sit; 10 Walking Burpees; × 3 sets. Additional circuit: Walking Burpees 5/7/9; Elbow plank 45s/60s/45s; Backward bear crawl 10m/15m/20m; GB Squats 10/8/6; Swings 15/20; Wall Sit 45s/60s/45s; Walking burpees 5/7/9; GB Carry hold 30s/45s/30s; × 3.",
    intermediateWorkouts:
      "100 Skips; 10 Squat Jumps; 10 Push ups; 1 min Elbow plank; 10 Burpees; 100 mts Farmer's Carry; × 5 sets.",
    status: "ACTIVE",
  },
  {
    id: "CLS-005",
    name: "Five-O/ Fiery 50",
    beginnerWorkouts: "Not specified",
    intermediateWorkouts:
      "50 Squats; 50 Pulls; 50 Hinges; 50 Push; 50mt Crawl; 500m Carry.",
    status: "ACTIVE",
  },
  {
    id: "CLS-006",
    name: "Super-sets",
    beginnerWorkouts:
      "Push-ups 4–8; Bear Crawl 10m × 3. GB Squats 10; Wall Sit 30–60s × 3. Deadlift 10; Elbow plank 30–60s × 3. Hori Pulls 6–8; Farmer's Carry 40m × 3.",
    intermediateWorkouts:
      "Push-ups 10; OH Press 10 × 3. GB Squats 10; Sumo Squat hold 30s × 3. Hori Pulls 8; Lat Pull down 10 × 3. Farmers March 30–45s; Inchworm 5 × 3. GB Swings 15; Step Ups 8/8 × 3.",
    status: "ACTIVE",
  },
  {
    id: "CLS-007",
    name: "Easy Strength",
    beginnerWorkouts:
      "Farmer's Carry 100m × 3; Bear Crawl 10m × 3; Push-ups 8 × 3; Deadhang 30–60s × 3; GB Squats 10 × 3; Hori Pulls 10 × 3; Wall Sit 45s × 3; Ape Hops 20m × 3.",
    intermediateWorkouts: "Not specified",
    status: "ACTIVE",
  },
  {
    id: "CLS-008",
    name: "4 Levels",
    beginnerWorkouts:
      "Hori Pulls 8; GB Swings 15; Bird Dog 8/8; Elbow plank 45–60s; × 3. Marching (w/weights) 1 min; Superman plank 30s; Push ups 3; GB Squats 8; Deadhang 40s; × 3.",
    intermediateWorkouts: "Not specified",
    status: "ACTIVE",
  },
  {
    id: "CLS-009",
    name: "Tri-sets",
    beginnerWorkouts: "Not specified",
    intermediateWorkouts:
      "Set 1: Hori Pulls 6; Deadhang shrugs 10; F.Carry hold 30–60s; × 2–3 sets. Set 2: Deadlift 5–8; Step Ups 8/8; Hip Bridge hold w/weight 30s; × 2–3 sets. Set 3: Push ups 4–6; OH press 5–8; High Plank 30s; × 2–3 sets. Set 4: Squats 8; Ape Hops 10m; Sumo Squat hold 30s; × 2–3 sets.",
    status: "ACTIVE",
  },
  {
    id: "CLS-010",
    name: "4321",
    beginnerWorkouts:
      "Push ups/Plate/Bench Press 5–10 × 4. Goblet Squats 8–12; TB Deadlift 5–8 × 3. Hori Pull 10; Pulls/Lat Pull down 2–6; Single Arm Rows 8/8 × 2. Wall Sit 100s; Elbow plank 60s; Deadhang 60s; Burpees 20.",
    intermediateWorkouts:
      "Push-ups 4–8 × 4. Lat Pull down 6–10; Bent over rows 6–8; F.Carry hold 30s × 3. Deadlift 5–8; Squats 6–10 × 2. Burpees 40; Mixed Crawls 3 mins; Calf/Toe Raises 50; Plank 3 mins × 1.",
    status: "ACTIVE",
  },
  {
    id: "CLS-011",
    name: "Pull,Push, Squats, Core",
    beginnerWorkouts:
      "3 sets each: Pulls — Hori Pulls 6–8, Single Arm rows 8/8. Push — Push-ups 6, Plate press 8. Squats — Step Ups 8/8, GB Squats 6–8, Trap Bar Deadlift 8. Core — Deadbug 10/10, Superman pulses 30s, Elbow plank 60s.",
    intermediateWorkouts: "Not specified",
    status: "ACTIVE",
  },
  {
    id: "CLS-012",
    name: "Double Trouble",
    beginnerWorkouts:
      "Push-ups 5; Rest 30s; Push ups 5. GB Squats 6–8; Rest 30s; GB Squats 6–8. Hori Pulls 6–8; Rest 30s; Hori Pulls 6–8. GB Swings 12–15; Rest 30s; GB Swings 12–15. Crawls 10m/30s; Rest 30s; Crawls 10m/30s. Carries 1–2 min; Rest 30s; Carries 1–2 min.",
    intermediateWorkouts: "Not specified",
    status: "ACTIVE",
  },
  {
    id: "CLS-013",
    name: "Farmer's Strength",
    beginnerWorkouts:
      "Get the Numbers; Stairs; Wall Sit; Carries; Crawl; Elbow plank; Squats; Pulls; Walking burpees.",
    intermediateWorkouts: "Not specified",
    status: "ACTIVE",
  },
  {
    id: "CLS-014",
    name: "250",
    beginnerWorkouts:
      "5 Push ups; 5 GB Squats; 5 Pulls; 5 Deadlift; 5 Walking Burpees; × 5 sets; and repeat. 125 reps – break – 125 reps.",
    intermediateWorkouts: "Not specified",
    status: "ACTIVE",
  },
  {
    id: "CLS-015",
    name: "Pull & Legs",
    beginnerWorkouts: "Not specified",
    intermediateWorkouts:
      "Pulls 2–5 × 3–5 sets; Bent over rows 8 × 3; Hori Pulls 8 × 3; Single Arm rows 8/8 × 3. Staggered Goblet Squat 8/8 × 3; Step Ups 8/8 × 3; Stationary Lunges 10/10 × 3; Wt Wall Sit 45s × 3.",
    status: "ACTIVE",
  },
];

module.exports = {
  SEED_CLASSES,
};
