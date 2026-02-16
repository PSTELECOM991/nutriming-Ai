
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Product, Transaction, TransactionType, InventoryStats } from './types';
import Dashboard from './components/Dashboard';
import InventoryTable from './components/InventoryTable';
import HistoryLog from './components/HistoryLog';
import AIAnalysis from './components/AIAnalysis';
import Welcome from './components/Welcome';
import { getInventoryInsights, AIAnalysisResult } from './services/geminiService';
import * as driveService from './services/driveService';
import { translations, Language } from './translations';

const INITIAL_PRODUCTS: Product[] = [
  { id: '1', sku: 'LAP-001', name: 'MacBook Pro M3', category: 'Electronics', quantity: 15, minThreshold: 5, purchasePrice: 140000, sellingPrice: 169900, boxNumber: 'A-01', description: 'Apple Laptop', lastUpdated: Date.now() },
  { id: '2', sku: 'MOU-002', name: 'Logitech MX Master 3', category: 'Accessories', quantity: 2, minThreshold: 10, purchasePrice: 7000, sellingPrice: 9500, boxNumber: 'B-12', description: 'Wireless Mouse', lastUpdated: Date.now() },
  { id: '3', sku: 'MON-003', name: 'Dell UltraSharp 27"', category: 'Electronics', quantity: 0, minThreshold: 3, purchasePrice: 32000, sellingPrice: 38000, boxNumber: 'C-05', description: '4K Monitor', lastUpdated: Date.now() },
  { id: '4', sku: 'KEY-004', name: 'Keychron K2 V2', category: 'Accessories', quantity: 45, minThreshold: 15, purchasePrice: 5500, sellingPrice: 7500, boxNumber: 'B-14', description: 'Mechanical Keyboard', lastUpdated: Date.now() },
];

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('app_lang');
    return (saved as Language) || 'en';
  });

  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    const sessionSeen = sessionStorage.getItem('ps_telecom_welcome_seen');
    return sessionSeen !== 'true';
  });

  const t = translations[lang];

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('stock_products');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((p: any) => ({
        ...p,
        boxNumber: p.boxNumber || 'N/A',
        purchasePrice: p.purchasePrice || p.unitPrice || 0,
        sellingPrice: p.sellingPrice || p.unitPrice || 0
      }));
    }
    return INITIAL_PRODUCTS;
  });
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('stock_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'history' | 'analysis'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [modalType, setModalType] = useState<'STOCK_ACTION' | 'PRODUCT_FORM' | 'FIND_PRODUCT'>('STOCK_ACTION');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockActionType, setStockActionType] = useState<TransactionType>(TransactionType.IN);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [finderQuery, setFinderQuery] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [formShowCost, setFormShowCost] = useState(false);
  
  const [driveLinked, setDriveLinked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(() => {
    const saved = localStorage.getItem('last_drive_sync');
    return saved ? parseInt(saved) : null;
  });

  const profileRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
  }, [lang]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const loadGapi = async () => {
      try { await driveService.initDriveClient(); } catch (err) { console.warn('GAPI Init skipped'); }
    };
    loadGapi();
  }, []);

  const handleWelcomeFinish = () => {
    sessionStorage.setItem('ps_telecom_welcome_seen', 'true');
    setShowWelcome(false);
  };

  const initAudio = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
  };

  const playChaChing = () => {
    initAudio();
    const ctx = audioCtxRef.current!;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(now + 0.3);
  };

  useEffect(() => { localStorage.setItem('stock_products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('stock_transactions', JSON.stringify(transactions)); }, [transactions]);

  const handleExportBackup = () => {
    const data = { version: '1.1', timestamp: Date.now(), products, transactions };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setIsProfileOpen(false);
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.products) {
          setProducts(json.products);
          setTransactions(json.transactions || []);
          alert('Success!');
        }
      } catch (err) { alert('Parse error.'); }
      setIsProfileOpen(false);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleLinkDrive = async () => {
    try { await driveService.authenticateDrive(); setDriveLinked(true); } catch (err) { alert('Drive connection failed.'); }
  };

  const handleDriveSync = async () => {
    if (!driveLinked) return;
    setIsSyncing(true);
    try {
      const data = { version: '1.1', timestamp: Date.now(), products, transactions };
      await driveService.uploadToDrive(data);
      setLastSync(Date.now());
      alert('Synced!');
    } finally { setIsSyncing(false); setIsProfileOpen(false); }
  };

  const stats: InventoryStats = useMemo(() => {
    return {
      totalItems: products.reduce((acc, p) => acc + p.quantity, 0),
      lowStockItems: products.filter(p => p.quantity > 0 && p.quantity <= p.minThreshold).length,
      totalValue: products.reduce((acc, p) => acc + (p.quantity * p.sellingPrice), 0),
      outOfStock: products.filter(p => p.quantity <= 0).length,
    };
  }, [products]);

  const openStockAction = (type: TransactionType, product: Product | null = null) => {
    setStockActionType(type);
    setSelectedProduct(product);
    setModalType('STOCK_ACTION');
    setIsModalOpen(true);
  };

  const openProductForm = (product: Product | null = null) => {
    setSelectedProduct(product);
    setFormShowCost(false);
    setModalType('PRODUCT_FORM');
    setIsModalOpen(true);
  };

  const openFinder = () => {
    setFinderQuery('');
    setModalType('FIND_PRODUCT');
    setIsModalOpen(true);
  };

  const processStockTransaction = (productId: string, amount: number, reason: string, newBoxNumber?: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const newQty = stockActionType === TransactionType.IN 
      ? product.quantity + amount 
      : Math.max(0, product.quantity - amount);

    if (stockActionType === TransactionType.OUT && amount > 0) playChaChing();
    
    setProducts(prev => prev.map(p => p.id === productId ? { 
      ...p, 
      quantity: newQty, 
      boxNumber: newBoxNumber || p.boxNumber,
      lastUpdated: Date.now() 
    } : p));

    const newTx: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      productId, 
      productName: product.name, 
      type: stockActionType, 
      quantity: amount, 
      reason: newBoxNumber && newBoxNumber !== product.boxNumber ? `${reason} (Box: ${newBoxNumber})` : reason,
      timestamp: Date.now(), 
      userId: 'Admin',
    };
    setTransactions(prev => [...prev, newTx]);
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const saveProduct = (data: Partial<Product>) => {
    if (selectedProduct) {
      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, ...data, lastUpdated: Date.now() } as Product : p));
    } else {
      const newProduct: Product = {
        id: Math.random().toString(36).substr(2, 9),
        sku: data.sku || `SKU-${Math.floor(Math.random() * 1000)}`,
        name: data.name || 'New Product',
        category: data.category || 'Uncategorized',
        quantity: data.quantity || 0,
        minThreshold: data.minThreshold || 5,
        purchasePrice: data.purchasePrice || 0,
        sellingPrice: data.sellingPrice || 0,
        boxNumber: data.boxNumber || 'N/A',
        description: data.description || '',
        lastUpdated: Date.now(),
      };
      setProducts(prev => [...prev, newProduct]);
    }
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const runAnalysis = async () => {
    if (!isOnline) return;
    setIsGeneratingInsights(true);
    try {
      const result = await getInventoryInsights(products, transactions, lang);
      setAiAnalysis(result);
    } finally { setIsGeneratingInsights(false); }
  };

  useEffect(() => { if (isOnline && !showWelcome) runAnalysis(); }, [products.length, isOnline, lang, showWelcome]);

  const filteredFinderProducts = useMemo(() => {
    if (!finderQuery) return [];
    const query = finderQuery.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query) || p.category.toLowerCase().includes(query)).slice(0, 5);
  }, [finderQuery, products]);

  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'inventory', label: t.inventory, icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { id: 'history', label: t.history, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'analysis', label: t.analysis, icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  ];

  if (showWelcome) {
    return <Welcome lang={lang} onEnter={handleWelcomeFinish} onLanguageChange={setLang} />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 md:flex-row font-sans overflow-hidden">
      <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />

      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col p-4 shrink-0 shadow-xl">
        <div className="flex items-center gap-3 px-2 mb-10 mt-2">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
             <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <span className="text-white font-black text-xl tracking-tight">{t.appTitle}</span>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 translate-x-1' : 'hover:bg-slate-800 text-slate-400'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} /></svg>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-5 bg-slate-800/50 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{t.riskMonitor}</span>
            <div className={`w-2 h-2 rounded-full ${stats.lowStockItems > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
          </div>
          <div className="text-xs">
            <p className="font-bold text-slate-200">{t.systemStatus}</p>
            <p className="text-slate-400 mt-0.5">{stats.lowStockItems} {t.itemsAtRisk}</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <header className="h-20 md:h-24 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-10 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <div className="md:hidden w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg mr-1">
               <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 capitalize tracking-tight leading-none">
                {activeTab === 'analysis' ? t.analysis : navItems.find(n => n.id === activeTab)?.label}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {driveLinked ? (
                   <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/></svg>
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{t.connected}</p>
                   </div>
                ) : (
                  <>
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isOnline ? 'Online' : 'Offline'}</p>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:flex items-center bg-slate-100 rounded-xl px-2 py-1 gap-1">
               <button onClick={() => setLang('en')} className={`px-2 py-1 text-[10px] font-bold rounded-lg ${lang === 'en' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>EN</button>
               <button onClick={() => setLang('bn')} className={`px-2 py-1 text-[10px] font-bold rounded-lg ${lang === 'bn' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>BN</button>
               <button onClick={() => setLang('hi')} className={`px-2 py-1 text-[10px] font-bold rounded-lg ${lang === 'hi' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>HI</button>
            </div>

            <button onClick={openFinder} className="p-3 text-slate-500 bg-slate-100 rounded-2xl hover:bg-slate-200 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
            <button onClick={() => openProductForm()} className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-lg active:scale-95">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </button>

            <div className="relative ml-2" ref={profileRef}>
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="w-10 h-10 md:w-12 md:h-12 bg-slate-100 border-2 border-white rounded-full flex items-center justify-center text-slate-700 font-bold text-sm shadow-md hover:bg-slate-200 active:scale-95">
                AD
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-72 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-[24px] shadow-2xl py-3 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  <div className="px-5 py-3 border-b border-slate-100 mb-2">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Administrator</p>
                    <p className="text-sm font-bold text-slate-900 truncate tracking-tight">System Master</p>
                  </div>
                  
                  <div className="px-5 py-2 space-y-2 sm:hidden border-b border-slate-100 pb-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{t.language}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setLang('en')} className={`flex-1 py-2 text-xs font-bold rounded-xl border ${lang === 'en' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>English</button>
                      <button onClick={() => setLang('bn')} className={`flex-1 py-2 text-xs font-bold rounded-xl border ${lang === 'bn' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>বাংলা</button>
                      <button onClick={() => setLang('hi')} className={`flex-1 py-2 text-xs font-bold rounded-xl border ${lang === 'hi' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>हिन्दी</button>
                    </div>
                  </div>

                  <div className="px-5 py-3 space-y-3">
                    <button onClick={handleLinkDrive} className="w-full flex items-center gap-3 py-3 px-4 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-2xl border border-slate-100 font-bold text-xs transition-colors">
                      {t.connectDrive}
                    </button>
                    {driveLinked && (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleDriveSync} disabled={isSyncing} className="py-3 bg-blue-50 text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-tight hover:bg-blue-100 transition-colors">{t.push}</button>
                        <button onClick={() => {}} className="py-3 bg-slate-50 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-tight hover:bg-slate-100 transition-colors">{t.pull}</button>
                      </div>
                    )}
                  </div>
                  <div className="h-px bg-slate-100 my-2"></div>
                  <div className="px-5 py-2">
                    <button onClick={handleExportBackup} className="w-full flex items-center gap-3 py-2 text-sm text-slate-600 font-bold hover:text-blue-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      {t.localExport}
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 py-2 text-sm text-slate-600 font-bold hover:text-blue-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      {t.localRestore}
                    </button>
                  </div>
                  <button className="w-full flex items-center gap-3 px-5 py-3 text-sm text-red-500 font-bold hover:bg-red-50 transition-colors">{t.logout}</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-32 md:pb-12 p-4 md:p-10 max-w-7xl mx-auto w-full scroll-smooth">
          {activeTab === 'dashboard' && <Dashboard products={products} stats={stats} lang={lang} />}
          {activeTab === 'inventory' && <InventoryTable products={products} onStockAction={(id, type) => openStockAction(type as TransactionType, products.find(p => p.id === id))} onEdit={(p) => openProductForm(p)} lang={lang} />}
          {activeTab === 'history' && <HistoryLog transactions={transactions} lang={lang} />}
          {activeTab === 'analysis' && <AIAnalysis data={aiAnalysis} isLoading={isGeneratingInsights} onRefresh={runAnalysis} isOnline={isOnline} lang={lang} />}
        </div>

        <div className="md:hidden fixed bottom-24 left-1/2 -translate-x-1/2 flex gap-3 z-40 px-4 w-full justify-center">
            <button onClick={() => openStockAction(TransactionType.IN)} className="flex-1 max-w-[140px] px-4 py-4 bg-emerald-600 text-white text-xs font-black uppercase rounded-2xl shadow-xl flex items-center justify-center gap-2">{t.stockIn}</button>
            <button onClick={() => openStockAction(TransactionType.OUT)} className="flex-1 max-w-[140px] px-4 py-4 bg-amber-600 text-white text-xs font-black uppercase rounded-2xl shadow-xl flex items-center justify-center gap-2">{t.stockOut}</button>
        </div>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 h-20 flex items-center justify-around px-4 z-40">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === item.id ? 'text-blue-600' : 'text-slate-400'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} /></svg>
              <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[100] flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="bg-white rounded-t-[40px] md:rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 md:animate-in md:fade-in md:zoom-in md:duration-200 max-h-[92vh] flex flex-col border border-white/20">
            <div className={`h-2.5 shrink-0 ${modalType === 'STOCK_ACTION' ? (stockActionType === TransactionType.IN ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-blue-500'}`} />
            <div className="p-8 md:p-10 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                    {modalType === 'STOCK_ACTION' ? `${stockActionType === TransactionType.IN ? t.stockIn : t.stockOut}` : (modalType === 'FIND_PRODUCT' ? t.quickFind : (selectedProduct ? t.editProduct : t.addProduct))}
                  </h3>
                  <p className="text-slate-400 text-xs md:text-sm mt-1 font-medium">{t.appTitle}</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              {modalType === 'STOCK_ACTION' ? (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  processStockTransaction(
                    formData.get('productId') as string, 
                    Number(formData.get('amount')), 
                    formData.get('reason') as string,
                    formData.get('newBoxNumber') as string
                  );
                }}>
                  <div className="space-y-6">
                    {!selectedProduct && (
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.tableHeaderProduct}</label>
                        <select 
                          name="productId" 
                          required 
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl appearance-none font-bold text-slate-800 focus:outline-none focus:border-blue-500/50"
                          onChange={(e) => {
                            const p = products.find(prod => prod.id === e.target.value);
                            setSelectedProduct(p || null);
                          }}
                        >
                          <option value="">{t.tableHeaderProduct}</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} • {p.sku}</option>)}
                        </select>
                      </div>
                    )}
                    {selectedProduct && <input type="hidden" name="productId" value={selectedProduct.id} />}
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.tableHeaderStock}</label>
                        <input name="amount" type="number" required min="1" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-2xl font-black text-slate-900 focus:outline-none focus:border-blue-500/50" placeholder="0" />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.boxNumber}</label>
                        <input 
                          name="newBoxNumber" 
                          type="text" 
                          defaultValue={selectedProduct?.boxNumber} 
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-blue-500/50" 
                          placeholder="A-01" 
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.reason}</label>
                        <input name="reason" type="text" required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-blue-500/50" placeholder="e.g. Sales" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-12">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-5 text-slate-400 font-black uppercase text-xs">{t.dismiss}</button>
                    <button type="submit" className={`flex-1 px-6 py-5 text-white font-black uppercase text-xs rounded-2xl shadow-2xl transition-all active:scale-95 ${stockActionType === TransactionType.IN ? 'bg-emerald-600 shadow-emerald-500/30' : 'bg-amber-600 shadow-amber-500/30'}`}>{t.commit}</button>
                  </div>
                </form>
              ) : modalType === 'FIND_PRODUCT' ? (
                <div className="space-y-6">
                  <div className="relative group">
                    <input autoFocus type="text" className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[30px] text-xl font-bold focus:outline-none focus:border-blue-500/50" placeholder={`${t.searchPlaceholder}`} value={finderQuery} onChange={(e) => setFinderQuery(e.target.value)} />
                    <svg className="w-6 h-6 text-slate-400 absolute left-5 top-5.5 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <div className="divide-y divide-slate-100 space-y-1">
                    {filteredFinderProducts.map(p => (
                      <div key={p.id} className="py-5 px-2 flex items-center justify-between hover:bg-slate-50 rounded-3xl group">
                        <div className="min-w-0 pr-6">
                          <p className="font-black text-slate-900 text-lg tracking-tight truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg uppercase">{p.sku}</span>
                             <span className="text-[10px] font-bold text-slate-400">• {t.tableHeaderBox} {p.boxNumber}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openStockAction(TransactionType.IN, p)} className="w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl font-black text-xl hover:bg-emerald-600 hover:text-white transition-all">+</button>
                          <button onClick={() => openStockAction(TransactionType.OUT, p)} className="w-10 h-10 flex items-center justify-center bg-amber-50 text-amber-600 rounded-xl font-black text-xl hover:bg-amber-600 hover:text-white transition-all">-</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  saveProduct({
                    name: formData.get('name') as string,
                    sku: formData.get('sku') as string,
                    category: formData.get('category') as string,
                    boxNumber: formData.get('boxNumber') as string,
                    purchasePrice: Number(formData.get('purchasePrice')),
                    sellingPrice: Number(formData.get('sellingPrice')),
                    minThreshold: Number(formData.get('threshold')),
                    description: formData.get('description') as string,
                    quantity: selectedProduct ? selectedProduct.quantity : Number(formData.get('initialStock') || 0)
                  });
                }}>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.productName}</label>
                        <input name="name" defaultValue={selectedProduct?.name} required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-blue-500/50" placeholder="e.g. Pixel 9 Pro" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.sku}</label>
                        <input name="sku" defaultValue={selectedProduct?.sku} required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-mono focus:outline-none focus:border-blue-500/50" placeholder="PX-001" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.category}</label>
                        <input name="category" defaultValue={selectedProduct?.category} required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-blue-500/50" placeholder="Mobile" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.boxNumber}</label>
                        <input name="boxNumber" defaultValue={selectedProduct?.boxNumber} required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-blue-500/50" placeholder="A-10" />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.minAlert}</label>
                        <input name="threshold" type="number" defaultValue={selectedProduct?.minThreshold} required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-blue-500/50" placeholder="5" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="relative group">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.costPrice}</label>
                        <div className="relative">
                          <input 
                            name="purchasePrice" 
                            type={formShowCost ? "number" : "password"}
                            step="0.01" 
                            defaultValue={selectedProduct?.purchasePrice} 
                            required 
                            className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-blue-500/50 pr-12" 
                            placeholder="0.00" 
                          />
                          <button 
                            type="button"
                            onClick={() => setFormShowCost(!formShowCost)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
                          >
                            {formShowCost ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L1 1m11 11l11 11" /></svg>
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.sellPrice}</label>
                        <input name="sellingPrice" type="number" step="0.01" defaultValue={selectedProduct?.sellingPrice} required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-blue-500/50" placeholder="0.00" />
                      </div>
                    </div>

                    {!selectedProduct && (
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.initialQty}</label>
                        <input name="initialStock" type="number" className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-blue-500/50" placeholder="0" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 mt-12">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-5 text-slate-400 font-black uppercase text-xs">{t.cancel}</button>
                    <button type="submit" className="flex-1 px-6 py-5 bg-blue-600 text-white font-black uppercase text-xs rounded-2xl shadow-2xl shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-95">{t.save}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
