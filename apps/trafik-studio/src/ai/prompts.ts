/** Trafik teorisi senaryosunu koruyan ana img2img şablonu. */
export const TRAFFIC_SCENARIO_PROMPT = `Recreate this exact traffic theory scenario. Strictly preserve the road layout, the direction and meaning of all arrows, and the exact angles and relative positions of all vehicles. Keep the traffic rule being illustrated identical. The overall composition and vehicle placement must stay the same. Style, colors, lighting, buildings and secondary details can be refreshed. If a logo is provided, place it naturally on the vehicles.`;

export function buildRecreatePrompt(hasLogo: boolean): string {
  if (!hasLogo) return TRAFFIC_SCENARIO_PROMPT;
  return `${TRAFFIC_SCENARIO_PROMPT} Integrate the provided driving-school logo naturally onto the vehicles (doors, hood or side panels) without covering arrows, signs or the road layout.`;
}
