
import { Product } from '../types.ts';

export const exportToCSV = (products: Product[]) => {
  if (products.length === 0) return;
  
  const headers = ['SKU', 'Name', 'Category', 'Quantity', 'Min Threshold', 'Purchase Price', 'Selling Price', 'Box Number', 'Description'];
  const csvContent = [
    headers.join(','),
    ...products.map(p => [
      `"${p.sku}"`,
      `"${p.name}"`,
      `"${p.category}"`,
      p.quantity,
      p.minThreshold,
      p.purchasePrice,
      p.sellingPrice,
      `"${p.boxNumber}"`,
      `"${p.description.replace(/"/g, '""')}"`
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const parseCSV = (text: string, existingProducts: Product[]): Product[] => {
  const lines = text.split('\n');
  const importedProducts: Product[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    
    if (values.length < 7) continue;

    const p: Partial<Product> = {
      id: crypto.randomUUID(),
      sku: values[0],
      name: values[1],
      category: values[2],
      quantity: parseInt(values[3]) || 0,
      minThreshold: parseInt(values[4]) || 0,
      purchasePrice: parseFloat(values[5]) || 0,
      sellingPrice: parseFloat(values[6]) || 0,
      boxNumber: values[7] || '',
      description: values[8] || '',
      lastUpdated: Date.now()
    };
    
    const existing = existingProducts.find(ep => ep.sku === p.sku);
    if (existing) {
      p.id = existing.id;
    }

    importedProducts.push(p as Product);
  }
  
  return importedProducts;
};
