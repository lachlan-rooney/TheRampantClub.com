// Curated descriptions for each whisky region we tag in the Rampant Room.
// Region keys must match the strings used in admin/whisky's REGIONS array.

export interface AtlasRegion {
  key: string                 // matches whiskies.region
  name: string
  native?: string             // local-script name, optional
  country: string             // ISO 3-letter or country name
  flag: string                // emoji flag
  blurb: string               // 1–2 sentence character summary
  character: string[]         // short tasting-keyword chips
  distilleries: string[]      // 3–5 representative names
  lat: number                 // marker latitude
  lng: number                 // marker longitude
}

// Sài Gòn coordinates — origin point for arcs from regions to home.
export const SAIGON: { lat: number; lng: number } = { lat: 10.776, lng: 106.695 }

export const ATLAS_REGIONS: AtlasRegion[] = [
  {
    key: 'Islay',
    name: 'Islay',
    native: 'Ìle',
    country: 'Scotland',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    blurb: 'A small Hebridean island whose peat-fired malts taste like the sea is in the room with you.',
    character: ['peat', 'iodine', 'smoke', 'brine', 'medicinal'],
    distilleries: ['Lagavulin', 'Laphroaig', 'Ardbeg', 'Bowmore', 'Caol Ila', 'Bunnahabhain'],
    lat: 55.74, lng: -6.20,
  },
  {
    key: 'Highland',
    name: 'Highland',
    native: 'A’ Ghàidhealtachd',
    country: 'Scotland',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    blurb: 'The largest, most varied region — coastal whiskies in the north, lighter expressions toward the south, almost everything in between.',
    character: ['heather', 'orange peel', 'oak', 'sea spray'],
    distilleries: ['Glenmorangie', 'Dalmore', 'Oban', 'Clynelish', 'Glendronach'],
    lat: 57.60, lng: -4.80,
  },
  {
    key: 'Speyside',
    name: 'Speyside',
    native: 'Spè',
    country: 'Scotland',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    blurb: 'Concentrated along the river Spey. Sherry-forward, fruit-driven, and home to more distilleries than anywhere else in the world.',
    character: ['sherry', 'orchard fruit', 'honey', 'spice'],
    distilleries: ['Macallan', 'Glenfiddich', 'Glenfarclas', 'Aberlour', 'Balvenie'],
    lat: 57.40, lng: -3.40,
  },
  {
    key: 'Campbeltown',
    name: 'Campbeltown',
    native: 'Ceann Loch Chille Chiarain',
    country: 'Scotland',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    blurb: 'Once the whisky capital of the world. Now three distilleries and a cult following — coastal, oily, gently smoked.',
    character: ['oily', 'coastal', 'briny', 'soft smoke'],
    distilleries: ['Springbank', 'Glen Scotia', 'Kilkerran'],
    lat: 55.43, lng: -5.60,
  },
  {
    key: 'Islands',
    name: 'Islands',
    native: 'Na h-Eileanan',
    country: 'Scotland',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    blurb: 'Orkney, Skye, Mull, Arran, Jura, Lewis. Distilleries scattered across the North Atlantic with as much in common as in difference.',
    character: ['salt', 'pepper', 'heather honey', 'maritime'],
    distilleries: ['Talisker', 'Highland Park', 'Jura', 'Tobermory', 'Arran'],
    lat: 58.98, lng: -2.96,    // Orkney centroid
  },
  {
    key: 'Lowland',
    name: 'Lowland',
    country: 'Scotland',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    blurb: 'Light, grassy, often triple-distilled. The aperitif end of Scotch, gentle and floral.',
    character: ['floral', 'lemon', 'grass', 'malt'],
    distilleries: ['Auchentoshan', 'Glenkinchie', 'Bladnoch', 'Daftmill'],
    lat: 55.95, lng: -3.20,    // Edinburgh-ish
  },
  {
    key: 'Ireland',
    name: 'Ireland',
    native: 'Éire',
    country: 'Ireland',
    flag: '🇮🇪',
    blurb: 'Triple-distilled and notably smooth. Pot still whiskey is a uniquely Irish style, full of spice and tropical fruit.',
    character: ['smooth', 'tropical fruit', 'pot still spice', 'vanilla'],
    distilleries: ['Redbreast', 'Green Spot', 'Bushmills', 'Teeling', 'Midleton'],
    lat: 53.41, lng: -8.24,
  },
  {
    key: 'Japan',
    name: 'Japan',
    native: '日本',
    country: 'Japan',
    flag: '🇯🇵',
    blurb: 'Refinement is the house style. Mizunara casks lend sandalwood and incense; the country’s climate ages whisky differently from anywhere else.',
    character: ['mizunara', 'incense', 'plum', 'precision'],
    distilleries: ['Yamazaki', 'Hakushu', 'Yoichi', 'Hibiki', 'Nikka', 'Mars'],
    lat: 36.20, lng: 138.25,
  },
  {
    key: 'USA',
    name: 'United States',
    country: 'USA',
    flag: '🇺🇸',
    blurb: 'Bourbon (Kentucky, mostly), Tennessee whiskey, and a renaissance of rye. Big oak, big sugar, big personality.',
    character: ['vanilla', 'caramel', 'oak char', 'rye spice'],
    distilleries: ['Buffalo Trace', 'Maker’s Mark', 'Woodford Reserve', 'Wild Turkey', 'Rittenhouse'],
    lat: 38.04, lng: -84.50,    // Lexington, KY
  },
  {
    key: 'Australia',
    name: 'Australia',
    country: 'Australia',
    flag: '🇦🇺',
    blurb: 'Tasmania leads the way. Small-cask maturation in a temperate climate produces whiskies of unusual depth for their age.',
    character: ['rich', 'fruit', 'oak-forward', 'small-batch'],
    distilleries: ['Sullivan’s Cove', 'Lark', 'Starward', 'Hellyers Road'],
    lat: -42.88, lng: 147.33,    // Hobart, Tasmania
  },
  {
    key: 'China',
    name: 'China',
    native: '中国',
    country: 'China',
    flag: '🇨🇳',
    blurb: 'A rising scene — Pernod Ricard, Diageo, and Chinese-led producers all building distilleries in the highlands of Sichuan and Yunnan.',
    character: ['emerging', 'hybrid styles'],
    distilleries: ['The Chuan', 'Aerstone (Diageo)', 'Lark Distilling China'],
    lat: 30.07, lng: 102.66,    // Sichuan
  },
  {
    key: 'England',
    name: 'England',
    country: 'England',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    blurb: 'A young modern industry — the first English single malt in over a century opened in 2003. Quietly excellent.',
    character: ['malt-forward', 'restrained', 'modern'],
    distilleries: ['English Whisky Co.', 'Cotswolds', 'Bimber', 'The Lakes'],
    lat: 52.20, lng: -1.50,
  },
  {
    key: 'New Zealand',
    name: 'New Zealand',
    country: 'New Zealand',
    flag: '🇳🇿',
    blurb: 'Tiny output but distinctive. Cardrona and others draw on alpine water and a maritime climate.',
    character: ['malt', 'fruit', 'clean'],
    distilleries: ['Cardrona', 'Thomson', 'New Zealand Whisky Co.'],
    lat: -44.86, lng: 168.95,    // Cardrona Valley
  },
  {
    key: 'Poland',
    name: 'Poland',
    native: 'Polska',
    country: 'Poland',
    flag: '🇵🇱',
    blurb: 'Better known for vodka, but boutique single malts are appearing — most famously the now-revered Kozuba & Sons.',
    character: ['rye-influenced', 'cereal', 'soft smoke'],
    distilleries: ['Kozuba & Sons', 'Goalen Head'],
    lat: 52.23, lng: 21.01,    // Warsaw
  },
  {
    key: 'Vietnam',
    name: 'Việt Nam',
    native: 'Việt Nam',
    country: 'Vietnam',
    flag: '🇻🇳',
    blurb: 'Home soil. The local whisky scene is in its infancy — but tropical maturation will produce something unique here, and we will be among the first to know.',
    character: ['emerging', 'tropical maturation', 'home'],
    distilleries: ['—'],
    lat: 10.776, lng: 106.695,    // Sài Gòn
  },
  {
    key: 'Taiwan',
    name: 'Taiwan',
    native: '臺灣',
    country: 'Taiwan',
    flag: '🇹🇼',
    blurb: 'Sub-tropical climate accelerates maturation dramatically. Kavalan is barely two decades old yet competes with the world\'s best.',
    character: ['tropical', 'mango', 'ripe sherry', 'fast-matured'],
    distilleries: ['Kavalan', 'Omar', 'Nantou'],
    lat: 23.69, lng: 120.96,
  },
  {
    key: 'India',
    name: 'India',
    native: 'भारत',
    country: 'India',
    flag: '🇮🇳',
    blurb: 'Heat and humidity force whisky to age fast and lose volume to the angels. Amrut and Paul John have made Indian single malt globally collectible.',
    character: ['tropical', 'spice', 'concentrated', 'high-angel-share'],
    distilleries: ['Amrut', 'Paul John', 'Rampur'],
    lat: 12.97, lng: 77.59,    // Bangalore (Amrut)
  },
  {
    key: 'Sweden',
    name: 'Sweden',
    native: 'Sverige',
    country: 'Sweden',
    flag: '🇸🇪',
    blurb: 'Cold maturation and Scandinavian oak give Mackmyra a distinct, juniper-tinged character no Scotch quite matches.',
    character: ['juniper', 'malt', 'cold-aged', 'restrained'],
    distilleries: ['Mackmyra', 'High Coast', 'Box / Smögen'],
    lat: 60.13, lng: 16.41,
  },
  {
    key: 'France',
    name: 'France',
    native: 'France',
    country: 'France',
    flag: '🇫🇷',
    blurb: 'Brittany pioneers, Cognac houses turning their hand to whisky, and Bordeaux-cask finishes that read like a wine list.',
    character: ['oak', 'wine cask', 'soft', 'gastronomic'],
    distilleries: ['Glann ar Mor', 'Domaine des Hautes Glaces', 'Brenne'],
    lat: 46.60, lng: 2.18,
  },
  {
    key: 'Wales',
    name: 'Wales',
    native: 'Cymru',
    country: 'Wales',
    flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    blurb: 'Welsh whisky vanished for a century and returned with Penderyn. Madeira and bourbon casks, soft mountain water.',
    character: ['light', 'fruit', 'madeira-finished'],
    distilleries: ['Penderyn', 'Aber Falls'],
    lat: 52.13, lng: -3.78,
  },
  {
    key: 'Other',
    name: 'Elsewhere',
    country: 'World',
    flag: '🌍',
    blurb: 'The rest of the whisky-making world — German, Dutch, Swiss, Czech and beyond. Where the most surprising bottles in the Rampant Room come from.',
    character: ['rare', 'experimental', 'one-off'],
    distilleries: ['Slyrs (Germany)', 'Millstone (Netherlands)', 'Säntis Malt (Switzerland)'],
    lat: 50.00, lng: 10.00,    // Central Europe
  },
]
