/**
 * LWANG BLACK — MULTI-REGION PRICING ENGINE
 * Real products from lwangblack.com.au with exact names, images & prices
 */

// Base CDN URL for Lwang Black product images
const CDN = 'https://www.lwangblack.com.au/cdn/shop/files/';

const LB_PRODUCTS = {
  '250g': {
    id: '250g',
    name: '250g Lwang Black',
    category: 'coffee',
    badge: 'BESTSELLER',
    image: 'https://cdn2.blanxer.com/uploads/68b26f1169953999df49c53a/product_image-dsc07401-8095.webp',
    description: 'Our signature clove-infused specialty Arabica. Bold, aromatic, and loaded with antioxidants. Perfect starter size for the Lwang Black experience.',
    stock: 48,
    allowed_regions: 'ALL',
    prices: {
      NP: { amount: 1599,  currency: 'NPR', symbol: 'Rs',  display: 'Rs 1,599' },
      AU: { amount: 27.00, currency: 'AUD', symbol: 'A$',  display: 'A$27.00' },
      US: { amount: 24.99, currency: 'USD', symbol: '$',   display: '$24.99'  },
      GB: { amount: 11.99, currency: 'GBP', symbol: '£',   display: '£11.99'  },
      CA: { amount: 24.99, currency: 'CAD', symbol: 'C$',  display: 'C$24.99' },
      DE: { amount: 12.99, currency: 'EUR', symbol: '€',   display: '€12.99'  },
      FR: { amount: 12.99, currency: 'EUR', symbol: '€',   display: '€12.99'  },
      NZ: { amount: 35.99, currency: 'NZD', symbol: 'NZ$', display: 'NZ$35.99'},
      SG: { amount: 17.99, currency: 'SGD', symbol: 'S$',  display: 'S$17.99' },
      JP: { amount: 2299,  currency: 'JPY', symbol: '¥',   display: '¥2,299' },
      DEFAULT: { amount: 24.99, currency: 'USD', symbol: '$', display: '$24.99' }
    }
  },
  '500g': {
    id: '500g',
    name: '500g Lwang Black',
    category: 'coffee',
    badge: 'POPULAR',
    image: 'https://cdn2.blanxer.com/uploads/68b26f1169953999df49c53a/product_image-dsc07374-1109.webp',
    description: 'The full Lwang Black experience. Rich clove fusion with specialty Arabica. Bold, deep, and satisfying every single cup.',
    stock: 32,
    allowed_regions: 'ALL',
    prices: {
      NP: { amount: 2599,  currency: 'NPR', symbol: 'Rs',  display: 'Rs 2,599' },
      AU: { amount: 37.00, currency: 'AUD', symbol: 'A$',  display: 'A$37.00'  },
      US: { amount: 38.99, currency: 'USD', symbol: '$',   display: '$38.99'   },
      GB: { amount: 19.99, currency: 'GBP', symbol: '£',   display: '£19.99'   },
      CA: { amount: 38.99, currency: 'CAD', symbol: 'C$',  display: 'C$38.99'  },
      DE: { amount: 22.99, currency: 'EUR', symbol: '€',   display: '€22.99'   },
      FR: { amount: 22.99, currency: 'EUR', symbol: '€',   display: '€22.99'   },
      NZ: { amount: 46.99, currency: 'NZD', symbol: 'NZ$', display: 'NZ$46.99' },
      SG: { amount: 30.99, currency: 'SGD', symbol: 'S$',  display: 'S$30.99'  },
      JP: { amount: 3719,  currency: 'JPY', symbol: '¥',   display: '¥3,719' },
      DEFAULT: { amount: 38.99, currency: 'USD', symbol: '$', display: '$38.99' }
    }
  },
  'drip-bags': {
    id: 'drip-bags',
    name: 'Lwang Black Drip Coffee Bags',
    category: 'coffee',
    image: 'https://cdn2.blanxer.com/uploads/68b26f1169953999df49c53a/product_image-dsc00258-4288.webp',
    description: 'Convenient single-serve drip bags. Perfect taste anywhere — no equipment needed. Clove goodness on the go.',
    stock: 60,
    allowed_regions: 'ALL',
    prices: {
      NP: { amount: 2200,  currency: 'NPR', symbol: 'Rs',  display: 'Rs 2,200' },
      AU: { amount: 16.99, currency: 'AUD', symbol: 'A$',  display: 'A$16.99'  },
      US: { amount: 11.99, currency: 'USD', symbol: '$',   display: '$11.99'   },
      GB: { amount: 9.99,  currency: 'GBP', symbol: '£',   display: '£9.99'    },
      DEFAULT: { amount: 12.99, currency: 'USD', symbol: '$', display: '$12.99' }
    }
  },
  'french-press': {
    id: 'french-press',
    name: 'French Press / Plunger',
    category: 'accessories',
    image: 'https://cdn2.blanxer.com/uploads/68b26f1169953999df49c53a/product_image-img_3964-4410.webp',
    description: '450ml plunge for the perfect brew. Built to maximize flavor extraction with every press. Available in three elegant colors.',
    stock: 15,
    allowed_regions: ['NP', 'AU', 'NZ', 'GB', 'CA'],
    variants: ['GREY', 'WHITE', 'BLACK'],
    prices: {
      NP: { amount: 4300,  currency: 'NPR', symbol: 'Rs', display: 'Rs 4,300' },
      AU: { amount: 34.99, currency: 'AUD', symbol: 'A$', display: 'A$34.99'  },
      NZ: { amount: 37.99, currency: 'NZD', symbol: 'NZ$',display: 'NZ$37.99' },
      GB: { amount: 26.99, currency: 'GBP', symbol: '£',  display: '£26.99'   },
      CA: { amount: 39.99, currency: 'CAD', symbol: 'C$', display: 'C$39.99'  },
      DEFAULT: null
    }
  },
  'brewing-pot': {
    id: 'brewing-pot',
    name: 'Lwang Black Brewing Pot',
    category: 'accessories',
    image: 'https://cdn2.blanxer.com/uploads/68b26f1169953999df49c53a/product_image-screenshot-2026-01-09-at-90813-pm-8845.webp',
    description: 'Hand-crafted premium brewing pot. Designed to maximize the clove fusion flavor and aroma with every brew.',
    stock: 10,
    allowed_regions: ['NP', 'AU', 'NZ', 'GB'],
    prices: {
      NP: { amount: 2700,  currency: 'NPR', symbol: 'Rs', display: 'Rs 2,700' },
      AU: { amount: 21.99, currency: 'AUD', symbol: 'A$', display: 'A$21.99'  },
      NZ: { amount: 23.99, currency: 'NZD', symbol: 'NZ$',display: 'NZ$23.99' },
      GB: { amount: 16.99, currency: 'GBP', symbol: '£',  display: '£16.99'   },
      DEFAULT: null
    }
  },
  'drip-sip-set': {
    id: 'drip-sip-set',
    name: 'LB Drip & Sip Set',
    category: 'accessories',
    image: 'https://cdn2.blanxer.com/uploads/68b26f1169953999df49c53a/product_image-dsc00248-9045.webp',
    description: 'Complete drip setup — everything you need for a perfect, clean cup. Minimalist, precise, effortless.',
    stock: 20,
    allowed_regions: ['NP', 'AU', 'US', 'GB', 'CA', 'NZ'],
    prices: {
      NP: { amount: 4300,  currency: 'NPR', symbol: 'Rs',  display: 'Rs 4,300' },
      AU: { amount: 34.99, currency: 'AUD', symbol: 'A$',  display: 'A$34.99'  },
      US: { amount: 24.99, currency: 'USD', symbol: '$',   display: '$24.99'   },
      GB: { amount: 19.99, currency: 'GBP', symbol: '£',   display: '£19.99'   },
      CA: { amount: 29.99, currency: 'CAD', symbol: 'C$',  display: 'C$29.99'  },
      NZ: { amount: 36.99, currency: 'NZD', symbol: 'NZ$', display: 'NZ$36.99' },
      DEFAULT: null
    }
  },
  'pot-press-gift-set': {
    id: 'pot-press-gift-set',
    name: 'LB Pot & Press Gift Set',
    category: 'bundles',
    badge: '🎁 BEST VALUE',
    image: 'https://cdn2.blanxer.com/uploads/68b26f1169953999df49c53a/product_image-dsc00545-4896.webp',
    description: 'The ultimate gift for coffee lovers. Everything they need to brew the perfect clove-infused cup — beautifully packaged.',
    stock: 12,
    allowed_regions: 'ALL',
    prices: {
      NP: { amount: 6699,  currency: 'NPR', symbol: 'Rs',  display: 'Rs 6,699' },
      AU: { amount: 87.00, currency: 'AUD', symbol: 'A$',  display: 'A$87.00'  },
      US: { amount: 69.99, currency: 'USD', symbol: '$',   display: '$69.99'   },
      GB: { amount: 52.99, currency: 'GBP', symbol: '£',   display: '£52.99'   },
      CA: { amount: 68.99, currency: 'CAD', symbol: 'C$',  display: 'C$68.99'  },
      NZ: { amount: 77.49, currency: 'NZD', symbol: 'NZ$', display: 'NZ$77.49' },
      JP: { amount: 7299,  currency: 'JPY', symbol: '¥',   display: '¥7,299' },
      DEFAULT: { amount: 69.99, currency: 'USD', symbol: '$', display: '$69.99' }
    }
  },
  'combo-set': {
    id: 'combo-set',
    name: '2.0 Combo Set',
    category: 'bundles',
    badge: 'COMBO DEAL',
    image: 'https://cdn2.blanxer.com/uploads/68b26f1169953999df49c53a/product_image-chatgpt-image-oct-11-2025-04_50_16-pm-8048.webp',
    description: 'Choose your French Press + 500g Lwang Black. Built for sharing the bold clove experience. Pick your color.',
    stock: 8,
    allowed_regions: ['NP', 'AU', 'NZ', 'GB', 'CA'],
    variants: ['GREY PRESS', 'WHITE PRESS', 'BLACK PRESS'],
    prices: {
      NP: { amount: 10400, currency: 'NPR', symbol: 'Rs',  display: 'Rs 10,400' },
      AU: { amount: 94.99, currency: 'AUD', symbol: 'A$',  display: 'A$94.99'   },
      NZ: { amount: 99.99, currency: 'NZD', symbol: 'NZ$', display: 'NZ$99.99'  },
      GB: { amount: 74.99, currency: 'GBP', symbol: '£',   display: '£74.99'    },
      CA: { amount: 104.99,currency: 'CAD', symbol: 'C$',  display: 'C$104.99'  },
      DEFAULT: null
    }
  },
  '250g-500g-bundle': {
    id: '250g-500g-bundle',
    name: '250g + 500g Lwang Black Bundle',
    category: 'bundles',
    badge: 'SAVE MORE',
    image: CDN + 'IMG_6794_ca7b2e9f-1110-47cd-b2b3-1fffbf370859.jpg?v=1753707754',
    description: 'Get both sizes together and save. Perfect for those who want the full Lwang Black experience at home and on the go.',
    stock: 20,
    allowed_regions: 'ALL',
    prices: {
      NP: { amount: 4900,  currency: 'NPR', symbol: 'Rs',  display: 'Rs 4,900' },
      AU: { amount: 49.99, currency: 'AUD', symbol: 'A$',  display: 'A$49.99'  },
      US: { amount: 34.99, currency: 'USD', symbol: '$',   display: '$34.99'   },
      GB: { amount: 28.99, currency: 'GBP', symbol: '£',   display: '£28.99'   },
      DEFAULT: { amount: 36.99, currency: 'USD', symbol: '$', display: '$36.99' }
    }
  },
  '250g-french-press': {
    id: '250g-french-press',
    name: '250g Lwang Black + French Press',
    category: 'bundles',
    image: CDN + 'DSC07401.jpg?v=1753318956',
    description: 'The perfect starter bundle. Our 250g clove coffee paired with a beautiful French Press — everything you need to start brewing.',
    stock: 14,
    allowed_regions: ['NP', 'AU', 'NZ', 'GB', 'CA', 'US'],
    prices: {
      NP: { amount: 5400,  currency: 'NPR', symbol: 'Rs',  display: 'Rs 5,400' },
      AU: { amount: 49.99, currency: 'AUD', symbol: 'A$',  display: 'A$49.99'  },
      US: { amount: 34.99, currency: 'USD', symbol: '$',   display: '$34.99'   },
      GB: { amount: 28.99, currency: 'GBP', symbol: '£',   display: '£28.99'   },
      NZ: { amount: 52.99, currency: 'NZD', symbol: 'NZ$', display: 'NZ$52.99' },
      CA: { amount: 44.99, currency: 'CAD', symbol: 'C$',  display: 'C$44.99'  },
      DEFAULT: { amount: 36.99, currency: 'USD', symbol: '$', display: '$36.99' }
    }
  },
  '500g-french-press': {
    id: '500g-french-press',
    name: '500g Lwang Black + French Press',
    category: 'bundles',
    badge: '🔥 SALE',
    image: CDN + 'IMG_1612.jpg?v=1753318956',
    description: 'Our most popular bundle. The full 500g of Lwang Black coffee with a premium French Press — a serious upgrade to your morning ritual.',
    stock: 18,
    allowed_regions: ['NP', 'AU', 'NZ', 'GB', 'CA', 'US'],
    prices: {
      NP: { amount: 6400,  currency: 'NPR', symbol: 'Rs',  display: 'Rs 6,400' },
      AU: { amount: 59.99, currency: 'AUD', symbol: 'A$',  display: 'A$59.99'  },
      US: { amount: 42.99, currency: 'USD', symbol: '$',   display: '$42.99'   },
      GB: { amount: 34.99, currency: 'GBP', symbol: '£',   display: '£34.99'   },
      NZ: { amount: 62.99, currency: 'NZD', symbol: 'NZ$', display: 'NZ$62.99' },
      CA: { amount: 54.99, currency: 'CAD', symbol: 'C$',  display: 'C$54.99'  },
      DEFAULT: { amount: 44.99, currency: 'USD', symbol: '$', display: '$44.99' }
    }
  },
  't-shirt': {
    id: 't-shirt',
    name: 'Classic T-Shirt',
    category: 'apparel',
    image: 'https://cdn2.blanxer.com/uploads/68b26f1169953999df49c53a/product_image-untitled-project-(1)-7725.webp',
    description: 'Premium cotton tee with tiger crest. Limited run.',
    stock: 50,
    allowed_regions: 'ALL',
    variants: ['S', 'M', 'L'],
    prices: {
      NP: { amount: 995,  currency: 'NPR', symbol: 'Rs',  display: 'Rs 995' },
      AU: { amount: 15.99, currency: 'AUD', symbol: 'A$',  display: 'A$15.99' },
      DEFAULT: { amount: 12.99, currency: 'USD', symbol: '$', display: '$12.99' }
    }
  }
};

// DHL estimated shipping rates (per country)
const DHL_SHIPPING_RATES = {
  NP: {
    standard: { price: 0, label: 'Standard Delivery (1–3 days)', carrier: 'Local Courier' },
    express:  { price: 0, label: 'Express Delivery (Same day KTM)', carrier: 'Local Express' }
  },
  AU: {
    standard: { price: 14.99, label: 'DHL Standard (5–8 days)', carrier: 'DHL' },
    express:  { price: 29.99, label: 'DHL Express (2–3 days)', carrier: 'DHL Express' }
  },
  US: {
    standard: { price: 12.99, label: 'DHL Standard (7–10 days)', carrier: 'DHL' },
    express:  { price: 34.99, label: 'DHL Express (3–5 days)', carrier: 'DHL Express' }
  },
  GB: {
    standard: { price: 11.99, label: 'DHL Standard (6–9 days)', carrier: 'DHL' },
    express:  { price: 26.99, label: 'DHL Express (2–4 days)', carrier: 'DHL Express' }
  },
  CA: {
    standard: { price: 15.99, label: 'DHL Standard (7–10 days)', carrier: 'DHL' },
    express:  { price: 36.99, label: 'DHL Express (3–5 days)', carrier: 'DHL Express' }
  },
  NZ: {
    standard: { price: 12.99, label: 'DHL Standard (5–7 days)', carrier: 'DHL' },
    express:  { price: 27.99, label: 'DHL Express (2–3 days)', carrier: 'DHL Express' }
  },
  DEFAULT: {
    standard: { price: 19.99, label: 'DHL Standard (8–14 days)', carrier: 'DHL' },
    express:  { price: 44.99, label: 'DHL Express (4–7 days)', carrier: 'DHL Express' }
  }
};

// Country code → display name map
const COUNTRY_NAMES = {
  NP: 'Nepal 🇳🇵', AU: 'Australia 🇦🇺', US: 'United States 🇺🇸',
  GB: 'United Kingdom 🇬🇧', CA: 'Canada 🇨🇦', DE: 'Germany 🇩🇪',
  FR: 'France 🇫🇷', NZ: 'New Zealand 🇳🇿', SG: 'Singapore 🇸🇬',
  AE: 'UAE 🇦🇪', IN: 'India 🇮🇳', JP: 'Japan 🇯🇵',
  CN: 'China 🇨🇳', KR: 'South Korea 🇰🇷', BR: 'Brazil 🇧🇷',
  OTHER: 'Other Region 🌍'
};

function getProductPrice(productId, countryCode) {
  const product = LB_PRODUCTS[productId];
  if (!product) return null;
  if (product.allowed_regions !== 'ALL') {
    if (!product.allowed_regions.includes(countryCode)) return null;
  }
  const prices = product.prices;
  return prices[countryCode] || prices.DEFAULT || null;
}

function isProductAvailable(productId, countryCode) {
  const product = LB_PRODUCTS[productId];
  if (!product) return false;
  if (product.allowed_regions === 'ALL') return true;
  return product.allowed_regions.includes(countryCode);
}

function getShippingRates(countryCode) {
  return DHL_SHIPPING_RATES[countryCode] || DHL_SHIPPING_RATES.DEFAULT;
}

function formatPrice(price) {
  if (!price) return null;
  return price.display;
}

window.LB_PRODUCTS = LB_PRODUCTS;
window.DHL_SHIPPING_RATES = DHL_SHIPPING_RATES;
window.COUNTRY_NAMES = COUNTRY_NAMES;
window.getProductPrice = getProductPrice;
window.isProductAvailable = isProductAvailable;
window.getShippingRates = getShippingRates;
window.formatPrice = formatPrice;
