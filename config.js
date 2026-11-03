// MG shop settings. Edit these without touching the rest of the site.
export default {
  // Orders are sent to this WhatsApp number: 01018178072, written in international format (Egypt = 20, no +, no leading 0).
  whatsapp: '201018178072',

  // Price per piece in Egyptian pounds, for the blank garment.
  prices: {
    hoodie: 650, hoodie_plain: 620, hoodie_zip: 750, hoodie_oversized: 750, hoodie_cropped: 600,
    crew: 500, crew_oversized: 600, quarter_zip: 650,
    joggers: 550, sweatpants: 550, shorts: 400,
  },
  printSidePrice: 150,                    // added per printed side (front / back)
  xxlSurcharge: 50,                       // added per 2XL piece
  bulkDiscounts: [[25, 0.20], [10, 0.10]], // [minimum pieces, discount], biggest first

  // Optional 3D model files per product (see MODEL_BRIEF.md). Products not listed use the built-in model.
  models: {
    hoodie: 'models/hoodie.glb', hoodie_plain: 'models/hoodie_plain.glb', hoodie_zip: 'models/hoodie_zip.glb', hoodie_oversized: 'models/hoodie_oversized.glb',
    hoodie_cropped: 'models/hoodie_cropped.glb', crew: 'models/crew.glb', crew_oversized: 'models/crew_oversized.glb',
    quarter_zip: 'models/quarter_zip.glb', joggers: 'models/joggers.glb', sweatpants: 'models/sweatpants.glb',
    shorts: 'models/shorts.glb',
  },
};
