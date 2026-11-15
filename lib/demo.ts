// Demo looks: shown on the landing page and seeded into the community feed by scripts/seed.ts.
// Look N has a generated photo at public/looks/NN.jpg; the photo was made from this garment list, so keep the two in step.
import type { Garment } from "./gemini";

const g = (category: string, description: string, color: string, price_usd: number): Garment =>
  ({ category, description, color, price_usd, price_is_estimate: true });

export type DemoLook = { author: string; height: number; garments: Garment[] };

export const DEMO: DemoLook[] = [
  { author: "maya", height: 520, garments: [g("dress", "flowing wrap midi dress", "red", 78), g("shoes", "block-heel sandals", "tan", 55), g("accessory", "small crossbody bag", "black", 40)] },
  { author: "leo", height: 440, garments: [g("outerwear", "oversized denim jacket", "light blue", 89), g("top", "heavyweight crew-neck tee", "white", 25), g("bottom", "relaxed cargo trousers", "olive", 60), g("shoes", "low-top leather sneakers", "white", 85)] },
  { author: "sofia", height: 480, garments: [g("outerwear", "single-breasted blazer", "beige", 120), g("top", "silk-blend camisole", "ivory", 45), g("bottom", "wide-leg tailored trousers", "beige", 80), g("shoes", "pointed-toe loafers", "black", 95)] },
  { author: "amir", height: 420, garments: [g("top", "short-sleeve linen shirt", "sky blue", 48), g("bottom", "pleated linen shorts", "cream", 42), g("shoes", "suede espadrilles", "navy", 65), g("accessory", "round sunglasses", "tortoiseshell", 30)] },
  { author: "maya", height: 460, garments: [g("dress", "satin slip mini dress", "black", 92), g("outerwear", "cropped leather biker jacket", "black", 180), g("shoes", "strappy heeled sandals", "silver", 70)] },
  { author: "jun", height: 500, garments: [g("top", "crewneck sweatshirt", "forest green", 55), g("bottom", "straight-leg jeans", "indigo", 68), g("shoes", "retro running sneakers", "grey", 90), g("accessory", "canvas tote bag", "natural", 18)] },
  { author: "sofia", height: 540, garments: [g("dress", "tiered floral maxi dress", "sage green", 85), g("outerwear", "cropped knit cardigan", "cream", 50), g("shoes", "leather ankle boots", "brown", 110), g("accessory", "woven straw hat", "natural", 28)] },
  { author: "leo", height: 430, garments: [g("outerwear", "lightweight zip running jacket", "charcoal", 75), g("top", "technical training tee", "black", 30), g("bottom", "tapered jogger pants", "charcoal", 55), g("shoes", "cushioned running shoes", "neon yellow", 130)] },
  { author: "nadia", height: 470, garments: [g("top", "ribbed knit tank", "pink", 32), g("bottom", "pleated midi skirt", "navy", 64), g("shoes", "leather ballet flats", "black", 72), g("accessory", "mini shoulder bag", "pink", 45)] },
  { author: "amir", height: 510, garments: [g("outerwear", "wool overcoat", "brown", 210), g("top", "merino roll-neck", "cream", 70), g("bottom", "slim wool trousers", "charcoal", 95), g("shoes", "chelsea boots", "black", 140)] },
  { author: "elif", height: 450, garments: [g("top", "boxy graphic tee", "yellow", 28), g("bottom", "denim skirt", "light blue", 48), g("shoes", "platform sneakers", "white", 80), g("accessory", "bucket hat", "green", 22)] },
  { author: "nadia", height: 490, garments: [g("dress", "linen shirt dress", "blue", 88), g("shoes", "woven slide sandals", "tan", 50), g("accessory", "round sunglasses", "black", 26)] },
];
