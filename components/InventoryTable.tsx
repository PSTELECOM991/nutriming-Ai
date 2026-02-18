
import React, { useState } from 'react';
import { Product } from '../types.ts';
import { Language, translations } from '../translations.ts';

interface InventoryTableProps {
  products: Product[];
  onStockAction: (id: string, type: 'IN' | 'OUT') => void;
  onEdit: (product: Product) => void;
  lang: Language;
}

const InventoryTable: React.FC<InventoryTableProps> = ({ products, onStockAction, onEdit, lang }) => {
  const t = translations[lang];
  const [searchTerm, setSearchTerm] = useState('');
  const [showCost, setShowCost] = useState(false);

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.boxNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const StatusBadge = ({ product }: { product: Product }) => {
    if (product.quantity <= 0) {
      return <span className="text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">{t.outOfStock}</span>;
    }
    if (product.quantity <= product.minThreshold) {
      return <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 px-2 py-0.5 rounded border border-amber-100">{t.lowStock}</span>;
    }
    return <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100">{t.inStock}</span>;
  };

  return (
    <div className="bg-white rounded-2xl md:border border-slate-200 shadow-sm md:overflow-hidden overflow-visible">
      <div className="p-4 md:border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 self-start md:self-auto">
          <h3 className="text-lg font-bold text-slate-800">{t.inventory}</h3>
          <button 
            onClick={() => setShowCost(!showCost)}
            className={`p-1.5 rounded-lg transition-all ${showCost ? 'text-blue-600 bg-blue-50' : 'text-slate-400 bg-slate-50 hover:text-slate-600'}`}
            title={showCost ? "Hide" : "Show"}
          >
            {showCost ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L1 1m11 11l11 11" /></svg>
            )}
          </button>
        </div>
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="md:hidden space-y-3 pt-2">
        {filtered.map(product => (
          <div key={product.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div className="min-w-0 pr-2">
                <h4 className="font-bold text-slate-800 text-sm truncate">{product.name}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{product.sku}</p>
                  <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-black uppercase">{t.tableHeaderBox} {product.boxNumber}</span>
                </div>
              </div>
              <StatusBadge product={product} />
            </div>
            
            <div className="flex items-center justify-between mt-1">
              <div className="flex gap-4">
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">{t.tableHeaderStock}</p>
                  <p className="text-sm font-bold text-slate-700 font-mono">{product.quantity}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">{t.tableHeaderSell}</p>
                  <p className="text-sm font-bold text-slate-700">₹{product.sellingPrice.toLocaleString('en-IN')}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => onStockAction(product.id, 'IN')}
                  className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                </button>
                <button 
                  onClick={() => onStockAction(product.id, 'OUT')}
                  className="w-8 h-8 flex items-center justify-center bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-600 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
                </button>
                <button 
                  onClick={() => onEdit(product)}
                  className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg ml-1 hover:bg-blue-600 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
              <th className="px-6 py-4">{t.tableHeaderProduct}</th>
              <th className="px-6 py-4">{t.tableHeaderBox}</th>
              <th className="px-6 py-4">{t.tableHeaderStatus}</th>
              <th className="px-6 py-4">{t.tableHeaderStock}</th>
              <th className="px-6 py-4">{t.tableHeaderCost}</th>
              <th className="px-6 py-4">{t.tableHeaderSell}</th>
              <th className="px-6 py-4 text-right">{t.tableHeaderActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-800">{product.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono tracking-tight uppercase">{product.sku}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-tight">
                    {product.boxNumber}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge product={product} />
                </td>
                <td className="px-6 py-4 font-mono font-bold text-slate-700">
                  {product.quantity}
                </td>
                <td className="px-6 py-4 text-slate-500 font-medium text-sm">
                  {showCost ? (
                    `₹${product.purchasePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                  ) : (
                    <span className="text-slate-300 select-none tracking-widest font-black">₹ ••••</span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-900 font-bold text-sm">
                  ₹{product.sellingPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onStockAction(product.id, 'IN')} className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg></button>
                    <button onClick={() => onStockAction(product.id, 'OUT')} className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg></button>
                    <button onClick={() => onEdit(product)} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryTable;
