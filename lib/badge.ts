export type BadgeColor = "GREEN" | "YELLOW" | "RED";
export type HormuzStatus = "OPEN" | "CLOSED" | "UNKNOWN";

const TACO_LOW = Number(process.env.TACO_THRESHOLD_LOW ?? 4.0);
const TACO_HIGH = Number(process.env.TACO_THRESHOLD_HIGH ?? 7.0);

export function computeBadge(
  hormuz: HormuzStatus,
  tacoScore: number
): BadgeColor {
  const high = tacoScore >= TACO_HIGH;
  const moderate = tacoScore >= TACO_LOW;

  if (hormuz === "UNKNOWN") return "YELLOW";
  if (hormuz === "CLOSED" && high) return "RED";
  if (hormuz === "CLOSED" || high) return "YELLOW";
  if (moderate) return "YELLOW";
  return "GREEN";
}
