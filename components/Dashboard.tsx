
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import { Product, InventoryStats } from '../types.ts';
import { Language, translations } from '../translations.ts';

interface DashboardProps {
  products: Product[];
  stats: InventoryStats;
  lang: Language;
  theme: 'light' | 'dark' | 'system';
}

const Dashboard: React.FC<DashboardProps> = ({ products, stats, lang, theme }) => {
  const t = translations[lang];
  
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  const chartData = products.slice(0, 8).map(p => ({
    name: p.name,
    qty: p.quantity,
    min: p.minThreshold
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: t.inventory, value: stats.totalItems, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: t.lowStock, value: stats.lowStockItems, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: t.outOfStock, value: stats.outOfStock, color: 'text-red-600', bg: 'bg-red-50' },
          { label: t.statsValue, value: `₹${(stats.totalValue / 1000).toFixed(1)}k`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} p-4 md:p-6 rounded-2xl border border-white/50 shadow-sm transition-transform hover:scale-[1.02]`}>
            <p className="text-slate-500 text-[10px] md:text-sm font-bold uppercase tracking-wider">{stat.label}</p>
            <p className={`text-xl md:text-3xl font-black mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm md:text-lg font-bold mb-4 md:mb-6 text-slate-800 dark:text-white">{t.inventory} {t.statsTotal}</h3>
          <div className="h-48 md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#1e293b" : "#f1f5f9"} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                    fontSize: '10px',
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    color: isDark ? '#f8fafc' : '#1e293b'
                  }}
                  itemStyle={{ color: isDark ? '#f8fafc' : '#1e293b' }}
                  cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }}
                />
                <Bar dataKey="qty" fill="#3b82f6" radius={[4, 4, 0, 0]} name={t.tableHeaderStock} />
                <Bar dataKey="min" fill={isDark ? "#334155" : "#cbd5e1"} radius={[4, 4, 0, 0]} name={t.minAlert} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center">
          <h3 className="text-sm md:text-lg font-bold mb-4 text-slate-800 dark:text-white w-full text-left">{t.category}</h3>
          <div className="h-40 md:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Object.entries(products.reduce((acc, p) => {
                    acc[p.category] = (acc[p.category] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {products.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
