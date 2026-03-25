export interface ShopifyProduct {
  handle: string;
  title: string;
  description: string;
  vendor: string;
  tags: string;
  price: number;
  compareAtPrice: number;
  images: string[];
}

const SHOPIFY_HEADERS = [
  'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags',
  'Published', 'Option1 Name', 'Option1 Value', 'Variant SKU', 'Variant Grams',
  'Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy',
  'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price',
  'Variant Requires Shipping', 'Variant Taxable', 'Image Src', 'Image Position',
  'Status'
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateShopifyCSV(products: ShopifyProduct[]): string {
  const rows: string[][] = [SHOPIFY_HEADERS];

  for (const product of products) {
    // First row: product + first image
    const firstRow = [
      product.handle,
      product.title,
      product.description ? `<p>${product.description}</p>` : '',
      product.vendor || 'Shopee',
      '', // Product Category
      '', // Type
      product.tags,
      'false', // Published
      'Title', // Option1 Name
      'Default Title', // Option1 Value
      '', // Variant SKU
      '0', // Variant Grams
      'shopify', // Variant Inventory Tracker
      '100', // Variant Inventory Qty
      'deny', // Variant Inventory Policy
      'manual', // Variant Fulfillment Service
      product.price.toFixed(2), // Variant Price
      product.compareAtPrice > 0 ? product.compareAtPrice.toFixed(2) : '', // Compare At Price
      'true', // Variant Requires Shipping
      'true', // Variant Taxable
      product.images[0] || '', // Image Src
      product.images[0] ? '1' : '', // Image Position
      'draft' // Status
    ];
    rows.push(firstRow);

    // Additional rows for extra images
    for (let i = 1; i < product.images.length; i++) {
      const imageRow = new Array(SHOPIFY_HEADERS.length).fill('');
      imageRow[0] = product.handle; // Handle
      imageRow[SHOPIFY_HEADERS.indexOf('Image Src')] = product.images[i];
      imageRow[SHOPIFY_HEADERS.indexOf('Image Position')] = String(i + 1);
      rows.push(imageRow);
    }
  }

  return rows.map(row => row.map(escapeCSV).join(',')).join('\n');
}

export function downloadCSV(csv: string, filename: string) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function createHandle(title: string, index: number): string {
  const base = slugify(title);
  return base || `product-${index + 1}`;
}
