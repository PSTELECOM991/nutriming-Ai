import React, { useState, useMemo } from 'react';
import { Product, Transaction, TransactionType } from '../../types.ts';
import { translations, Language } from '../../translations.ts';
import { format } from 'date-fns';
import { downloadCSV } from '../../services/csvService.ts';

interface ReportsProps {
  products: Product[];
  transactions: Transaction[];
  lang: Language;
}

const Reports: React.FC<ReportsProps> = ({ products, transactions, lang }) => {
  const t = translations[lang];
  const [activeReport, setActiveReport] = useState<'stock' | 'daily' | 'date'>('stock');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const dailyTransactions = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    return transactions.filter(tr => {
      const trDate = new Date(tr.timestamp).setHours(0, 0, 0, 0);
      return trDate === today && tr.type === TransactionType.OUT;
    });
  }, [transactions]);

  const dateWiseTransactions = useMemo(() => {
    const start = new Date(startDate).setHours(0, 0, 0, 0);
    const end = new Date(endDate).setHours(23, 59, 59, 999);
    return transactions.filter(tr => {
      const trDate = tr.timestamp;
      return trDate >= start && trDate <= end;
    });
  }, [transactions, startDate, endDate]);

  const stockSummary = useMemo(() => {
    return products.reduce((acc, p) => {
      acc.totalValue += p.stock * p.costPrice;
      acc.totalItems += p.stock;
      return acc;
    }, { totalValue: 0, totalItems: 0 });
  }, [products]);

  const dailySummary = useMemo(() => {
    return dailyTransactions.reduce((acc, tr) => {
      acc.totalRevenue += tr.quantity * tr.price;
      acc.totalQty += tr.quantity;
      return acc;
    }, { totalRevenue: 0, totalQty: 0 });
  }, [dailyTransactions]);

  const dateWiseSummary = useMemo(() => {
    return dateWiseTransactions.reduce((acc, tr) => {
      if (tr.type === TransactionType.OUT) {
        acc.totalRevenue += tr.quantity * tr.price;
        acc.totalOut += tr.quantity;
      } else {
        acc.totalIn += tr.quantity;
      }
      return acc;
    }, { totalRevenue: 0, totalIn: 0, totalOut: 0 });
  }, [dateWiseTransactions]);

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.error("Print failed:", e);
      alert("Print failed. Please try using your browser's print menu (Ctrl+P or Cmd+P).");
    }
  };

  const handleDownloadCSV = () => {
    if (activeReport === 'stock') {
      const headers = ['SKU', 'Name', 'Category', 'Box', 'Stock', 'Cost', 'Sell', 'Total Value'];
      const rows = products.map(p => [
        p.sku, p.name, p.category, p.boxNumber, p.stock, p.costPrice, p.sellPrice, p.stock * p.costPrice
      ]);
      downloadCSV(headers, rows, 'stock_report');
    } else if (activeReport === 'daily') {
      const headers = ['Time', 'Product', 'Quantity', 'Price', 'Total'];
      const rows = dailyTransactions.map(tr => {
        const p = products.find(prod => prod.id === tr.productId);
        return [format(tr.timestamp, 'HH:mm'), p?.name || 'Unknown', tr.quantity, tr.price, tr.quantity * tr.price];
      });
      downloadCSV(headers, rows, 'daily_sale_report');
    } else {
      const headers = ['Date', 'Type', 'Product', 'Quantity', 'Price'];
      const rows = dateWiseTransactions.map(tr => {
        const p = products.find(prod => prod.id === tr.productId);
        return [format(tr.timestamp, 'yyyy-MM-dd HH:mm'), tr.type, p?.name || 'Unknown', tr.quantity, tr.price];
      });
      downloadCSV(headers, rows, 'date_wise_report');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Report Selector */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit no-print">
        <button
          onClick={() => setActiveReport('stock')}
          className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeReport === 'stock' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          {t.allStockReport}
        </button>
        <button
          onClick={() => setActiveReport('daily')}
          className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeReport === 'daily' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          {t.dailySaleReport}
        </button>
        <button
          onClick={() => setActiveReport('date')}
          className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeReport === 'date' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          {t.dateWiseReport}
        </button>
      </div>

      {/* Filters for Date Wise Report */}
      {activeReport === 'date' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 flex flex-wrap items-end gap-4 shadow-sm no-print">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.startDate}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.endDate}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
            />
          </div>
          <div className="ml-auto flex gap-2 no-print">
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-black hover:bg-emerald-700 transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              CSV
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-sm font-black hover:bg-slate-800 transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              {t.print}
            </button>
          </div>
        </div>
      )}

      {activeReport !== 'date' && (
        <div className="flex justify-end gap-2 no-print">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-black hover:bg-emerald-700 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-sm font-black hover:bg-slate-800 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            {t.print}
          </button>
        </div>
      )}

      {/* Report Content */}
      <div id="printable-report" className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {activeReport === 'stock' ? t.allStockReport : activeReport === 'daily' ? t.dailySaleReport : t.dateWiseReport}
              </h2>
              <p className="text-sm text-slate-400 dark:text-slate-500 font-medium mt-1">
                {activeReport === 'date' ? `${startDate} to ${endDate}` : format(new Date(), 'PPPP')}
              </p>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <div className="flex gap-2 no-print">
                <button 
                  onClick={handleDownloadCSV}
                  className="p-2 bg-white dark:bg-slate-700 text-slate-400 hover:text-emerald-600 rounded-xl border border-slate-100 dark:border-slate-600 shadow-sm transition-all active:scale-90"
                  title="Download CSV"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
                <button 
                  onClick={handlePrint}
                  className="p-2 bg-white dark:bg-slate-700 text-slate-400 hover:text-blue-600 rounded-xl border border-slate-100 dark:border-slate-600 shadow-sm transition-all active:scale-90"
                  title={t.print}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                </button>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">PS Telecom</p>
                <p className="text-xs font-bold text-slate-500 mt-1">Inventory Management System</p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {activeReport === 'stock' && (
              <>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.statsTotal}</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{stockSummary.totalItems}</p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.statsValue}</p>
                  <p className="text-xl font-black text-blue-600 mt-1">৳{stockSummary.totalValue.toLocaleString()}</p>
                </div>
              </>
            )}
            {activeReport === 'daily' && (
              <>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.totalSales}</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{dailySummary.totalQty}</p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.totalRevenue}</p>
                  <p className="text-xl font-black text-emerald-600 mt-1">৳{dailySummary.totalRevenue.toLocaleString()}</p>
                </div>
              </>
            )}
            {activeReport === 'date' && (
              <>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.stockIn}</p>
                  <p className="text-xl font-black text-blue-600 mt-1">{dateWiseSummary.totalIn}</p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.stockOut}</p>
                  <p className="text-xl font-black text-amber-600 mt-1">{dateWiseSummary.totalOut}</p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.totalRevenue}</p>
                  <p className="text-xl font-black text-emerald-600 mt-1">৳{dateWiseSummary.totalRevenue.toLocaleString()}</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                {activeReport === 'stock' && (
                  <>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.tableHeaderProduct}</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.category}</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.tableHeaderBox}</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t.tableHeaderStock}</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t.costPrice}</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t.sellPrice}</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Value</th>
                  </>
                )}
                {activeReport === 'daily' && (
                  <>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.tableHeaderProduct}</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qty</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Price</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                  </>
                )}
                {activeReport === 'date' && (
                  <>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.tableHeaderProduct}</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qty</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Price</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {activeReport === 'stock' && products.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-8 py-4">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{p.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{p.sku}</p>
                  </td>
                  <td className="px-8 py-4">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded text-[10px] font-bold uppercase">{p.category}</span>
                  </td>
                  <td className="px-8 py-4 text-sm font-bold text-slate-600 dark:text-slate-400">{p.boxNumber}</td>
                  <td className="px-8 py-4 text-sm font-black text-slate-800 dark:text-slate-200 text-right">{p.stock}</td>
                  <td className="px-8 py-4 text-sm font-bold text-slate-600 dark:text-slate-400 text-right">৳{p.costPrice}</td>
                  <td className="px-8 py-4 text-sm font-bold text-slate-600 dark:text-slate-400 text-right">৳{p.sellPrice}</td>
                  <td className="px-8 py-4 text-sm font-black text-blue-600 text-right">৳{(p.stock * p.costPrice).toLocaleString()}</td>
                </tr>
              ))}
              {activeReport === 'daily' && dailyTransactions.map(tr => {
                const product = products.find(p => p.id === tr.productId);
                return (
                  <tr key={tr.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-8 py-4 text-sm font-bold text-slate-500">{format(tr.timestamp, 'HH:mm')}</td>
                    <td className="px-8 py-4 text-sm font-bold text-slate-800 dark:text-slate-200">{product?.name || 'Unknown'}</td>
                    <td className="px-8 py-4 text-sm font-black text-slate-800 dark:text-slate-200 text-right">{tr.quantity}</td>
                    <td className="px-8 py-4 text-sm font-bold text-slate-600 dark:text-slate-400 text-right">৳{tr.price}</td>
                    <td className="px-8 py-4 text-sm font-black text-emerald-600 text-right">৳{(tr.quantity * tr.price).toLocaleString()}</td>
                  </tr>
                );
              })}
              {activeReport === 'date' && dateWiseTransactions.map(tr => {
                const product = products.find(p => p.id === tr.productId);
                return (
                  <tr key={tr.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-8 py-4 text-sm font-bold text-slate-500">{format(tr.timestamp, 'MMM dd, HH:mm')}</td>
                    <td className="px-8 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${tr.type === TransactionType.IN ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        {tr.type === TransactionType.IN ? t.stockIn : t.stockOut}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-sm font-bold text-slate-800 dark:text-slate-200">{product?.name || 'Unknown'}</td>
                    <td className="px-8 py-4 text-sm font-black text-slate-800 dark:text-slate-200 text-right">{tr.quantity}</td>
                    <td className="px-8 py-4 text-sm font-bold text-slate-600 dark:text-slate-400 text-right">৳{tr.price}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
