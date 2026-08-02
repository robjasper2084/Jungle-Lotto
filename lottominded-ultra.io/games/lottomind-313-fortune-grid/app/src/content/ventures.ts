import type { DistrictId } from "./districts";
export interface Venture { id: number; name: string; district: DistrictId; launchCost: number; baseFee: number; description: string }
const names: [string, DistrictId, string][] = [
  ["Neon Compass Media", "downtown", "A projection and story studio"], ["Lantern Loop Café", "downtown", "A late-night creative café"], ["Skyline Signal House", "downtown", "A civic-minded media lab"],
  ["Blue Current Arcade", "riverfront", "A river-inspired play studio"], ["Rippleworks Lab", "riverfront", "A clean-tech idea workshop"], ["Moonwake Pavilion", "riverfront", "A floating performance concept"],
  ["Mosaic Beat Works", "midtown", "A neighborhood rhythm room"], ["Violet Frame Cinema", "midtown", "An experimental film collective"], ["Canvas Circuit Gallery", "midtown", "An interactive art space"],
  ["Future Forge 313", "innovation", "A prototype studio"], ["Quantum Porch Labs", "innovation", "An accessible technology co-op"], ["Signal Bloom Robotics", "innovation", "A friendly robotics workshop"],
  ["Amber Basket Market", "eastside", "A community food hall concept"], ["Sunrise Maker Exchange", "eastside", "A rotating maker market"], ["East Current Kitchen", "eastside", "A collaborative food studio"],
  ["Rhythm Bridge House", "southwest", "A multilingual music workshop"], ["Copper Cloud Café", "southwest", "A performance café concept"], ["Sol Street Studio", "southwest", "A dance and design room"],
  ["North Star Atelier", "northwest", "A future-fashion atelier"], ["Chrome Thread House", "northwest", "A wearable-art studio"], ["Grand Signal Salon", "northwest", "A style and media collective"],
  ["Porchlight Commons", "legacy", "A welcoming community room"], ["Story Garden Works", "legacy", "An intergenerational story lab"], ["Open Hand Workshop", "legacy", "A neighborhood skills exchange"]
];
export const ventures: Venture[] = names.map(([name, district, description], index) => ({ id: index, name, district, launchCost: 140 + (index % 3) * 20, baseFee: 28 + (index % 3) * 7, description }));
export const developmentNames = ["Unlaunched", "Pop-Up", "Local Favorite", "Creative Hub", "City Landmark"];
