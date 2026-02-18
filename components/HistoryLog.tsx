
import React from 'react';
import { Transaction, TransactionType } from '../types.ts';
import { Language, translations } from '../translations.ts';

interface HistoryLogProps {
  transactions: Transaction[];
  lang: Language;
}

const HistoryLog: React.FC<HistoryLogProps> = ({ transactions, lang }) => {
  const t = translations[lang];
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-lg font-bold dark:text-white">{t.activityLog}</h3>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        <div className="p-4 space-y-4">
          {[...transactions].reverse().map((tx) => (
            <div key={tx.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
              <div className={`mt-1 p-2 rounded-lg ${tx.type === TransactionType.IN ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {tx.type === TransactionType.IN 
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                  }
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {tx.productName}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium shrink-0">
                    {new Date(tx.timestamp).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  <span className={tx.type === TransactionType.IN ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                    {tx.type === TransactionType.IN ? '+' : '-'}{tx.quantity} units
                  </span>
                  {' • '}{tx.reason}
                </p>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">{t.noActivity}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryLog;
