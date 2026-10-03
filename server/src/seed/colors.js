// Seed colour catalogue. Names, codes and values are original to this project.
// Format: [code, name, hex, family, tags]
const L = 'Living Room';
const B = 'Bedroom';
const K = 'Kitchen';
const A = 'Accent';
const O = 'Office';
const BA = 'Bathroom';

const raw = [
  // Whites
  ['WH-101', 'Morning Linen', '#F4F1EA', 'White', [L, B]],
  ['WH-102', 'Cloud Cotton', '#F7F7F4', 'White', [K, BA]],
  ['WH-103', 'Ivory Whisper', '#F3EDDC', 'White', [L]],
  ['WH-104', 'Paper Lantern', '#EFE9DD', 'White', [B, O]],
  ['WH-105', 'Fresh Snow', '#FBFBFB', 'White', [BA, K]],
  // Neutrals
  ['NU-201', 'Warm Sandstone', '#D8C7A8', 'Neutral', [L]],
  ['NU-202', 'Oat Field', '#CDBFA6', 'Neutral', [L, B]],
  ['NU-203', 'Driftwood Grey', '#A9A296', 'Neutral', [O]],
  ['NU-204', 'Clay Pot', '#B9927A', 'Neutral', [K, A]],
  ['NU-205', 'Pebble Path', '#BDB7AE', 'Neutral', [L, O]],
  ['NU-206', 'Cashew Cream', '#E3D5BC', 'Neutral', [B]],
  // Greys
  ['GR-301', 'Silver Mist', '#C9CCCD', 'Grey', [O, BA]],
  ['GR-302', 'Harbour Fog', '#9EA4A6', 'Grey', [L]],
  ['GR-303', 'Slate Roof', '#6B7378', 'Grey', [A, O]],
  ['GR-304', 'Charcoal Ember', '#3F4245', 'Grey', [A]],
  ['GR-305', 'Dove Feather', '#D9D8D3', 'Grey', [B]],
  // Blues
  ['BL-401', 'Coastal Breeze', '#A9C6D8', 'Blue', [B, BA]],
  ['BL-402', 'Denim Dusk', '#4F6D8A', 'Blue', [A, O]],
  ['BL-403', 'Midnight Harbour', '#22344A', 'Blue', [A]],
  ['BL-404', 'Powder Sky', '#C8DCEA', 'Blue', [B]],
  ['BL-405', 'Lagoon Teal', '#3E8A8E', 'Blue', [A, BA]],
  ['BL-406', 'Cornflower Field', '#7C9CC9', 'Blue', [L]],
  // Greens
  ['GN-501', 'Sage Garden', '#A7B49A', 'Green', [L, K]],
  ['GN-502', 'Olive Grove', '#7A7D52', 'Green', [A]],
  ['GN-503', 'Mint Sorbet', '#CFE6D6', 'Green', [BA, B]],
  ['GN-504', 'Forest Canopy', '#2F4A3A', 'Green', [A, O]],
  ['GN-505', 'Eucalyptus Leaf', '#8FAE9E', 'Green', [L, BA]],
  ['GN-506', 'Pistachio Shell', '#C6D2A4', 'Green', [K]],
  // Yellows
  ['YE-601', 'Butter Toast', '#F2DFA0', 'Yellow', [K]],
  ['YE-602', 'Honey Drizzle', '#E3B759', 'Yellow', [A, K]],
  ['YE-603', 'Lemon Chiffon Dream', '#F6EDB8', 'Yellow', [B]],
  ['YE-604', 'Mustard Seed', '#C99A2E', 'Yellow', [A]],
  // Oranges
  ['OR-701', 'Apricot Glow', '#F2B98C', 'Orange', [L, K]],
  ['OR-702', 'Terracotta Sun', '#C46A45', 'Orange', [A]],
  ['OR-703', 'Peach Blossom', '#F6CDB2', 'Orange', [B]],
  ['OR-704', 'Burnt Saffron', '#D9822B', 'Orange', [A]],
  // Reds
  ['RD-801', 'Brick Hearth', '#9C4335', 'Red', [A]],
  ['RD-802', 'Rosewood', '#8A4A4A', 'Red', [A, O]],
  ['RD-803', 'Cranberry Jam', '#9E2F3F', 'Red', [A]],
  ['RD-804', 'Coral Reef', '#E7826D', 'Red', [L]],
  // Pinks
  ['PK-901', 'Blush Petal', '#EBCBC6', 'Pink', [B]],
  ['PK-902', 'Dusty Rose', '#C99A98', 'Pink', [B, L]],
  ['PK-903', 'Ballet Slipper', '#F3DCDA', 'Pink', [B]],
  ['PK-904', 'Raspberry Swirl', '#B85C78', 'Pink', [A]],
  // Purples
  ['PU-951', 'Lavender Haze', '#C9BCD9', 'Purple', [B, BA]],
  ['PU-952', 'Plum Velvet', '#5E3B5C', 'Purple', [A]],
  ['PU-953', 'Lilac Morning', '#DCD0E6', 'Purple', [B]],
  ['PU-954', 'Heather Moor', '#8C7A9C', 'Purple', [L, A]],
];

module.exports = raw.map(([code, name, hex, family, tags]) => ({
  code,
  name,
  hex,
  family,
  tags,
  brand: 'SWPV',
  finishes: ['matte', 'satin', 'glossy'],
}));
