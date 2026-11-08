// MG shop settings. Edit these without touching the rest of the site.
export default {
  // Orders are sent to this WhatsApp number: 01018178072, written in international format (Egypt = 20, no +, no leading 0).
  whatsapp: '201018178072',

  // Price per piece in Egyptian pounds, for the blank garment: the factory's wholesale price + PROFIT.
  // Classic hoodie here has the kangaroo pocket (factory: هودي كانجارو); the one without a pocket is the factory's هودي كلاسيك.
  prices: Object.fromEntries(Object.entries({
    hoodie: 370, hoodie_plain: 350, hoodie_pockets: 370, hoodie_zip: 450, hoodie_oversized: 400, hoodie_cropped: 350,
    crew: 350, quarter_zip: 400,
    joggers: 350, sweatpants: 380, shorts: 200,
  }).map(([k, cost]) => [k, cost + 100]).concat([['crew_oversized', 600]])),   // crew_oversized: not on the factory list yet
  // Launch offer: taken off every piece's garment price until the end date (profit 60 instead of 100). Drop it or set off: 0 to end it early.
  launchOffer: { off: 40, until: '2026-11-18T23:59:59+02:00' },
  // Added per piece for each printed zone (factory: chest logo / back print). Sleeve and hood prices are first guesses: set them.
  printPrices: { front: 30, back: 75, sleeveR: 30, sleeveL: 30, hood: 50 },
  // Sport stripes down the sleeves or legs, added per piece. A first guess: set the factory's price.
  stripesPrice: 30,
  // Store: storeFee is what the designer earns per piece, paid out once the balance reaches storePayoutMin.
  // storeMarkup is how much of it is added to the customer's price; the rest comes out of the shop's profit. 0 = all from the profit, 30 = all from the customer.
  storeFee: 30,
  storeMarkup: 0,
  storePayoutMin: 100,
  xxlSurcharge: 50,                       // added per 2XL piece
  bulkDiscounts: [[25, 0.20], [10, 0.10]], // [minimum pieces, discount], biggest first

  // Optional 3D model files per product (see MODEL_BRIEF.md). Products not listed use the built-in model.
  models: {
    hoodie: 'models/hoodie.glb', hoodie_plain: 'models/hoodie_plain.glb', hoodie_pockets: 'models/hoodie_pockets.glb', hoodie_zip: 'models/hoodie_zip.glb', hoodie_oversized: 'models/hoodie_oversized.glb',
    hoodie_cropped: 'models/hoodie_cropped.glb', crew: 'models/crew.glb', crew_oversized: 'models/crew_oversized.glb',
    quarter_zip: 'models/quarter_zip.glb', joggers: 'models/joggers.glb', sweatpants: 'models/sweatpants.glb',
    shorts: 'models/shorts.glb',
  },
};
