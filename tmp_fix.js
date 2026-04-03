const fs = require('fs');
const files = [
  'catalogue.html',
  'shop.html',
  'product.html',
  'checkout.html',
  'order-confirmation.html',
  'admin.html'
];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('<script src="geo-router.js"></script>')) {
    content = content.replace('<script src="region.js"></script>', '<script src="geo-router.js"></script>\n  <script src="region.js"></script>');
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
