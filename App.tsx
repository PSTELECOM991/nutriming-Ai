
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Product, Transaction, TransactionType, InventoryStats } from './types';
import Dashboard from './components/Dashboard';
import InventoryTable from './components/InventoryTable';
import HistoryLog from './components/HistoryLog';
import AIAnalysis from './components/AIAnalysis';
import Welcome from './components/Welcome';
import { getInventoryInsights, AIAnalysisResult } from './services/geminiService';
import * as driveService from './services/driveService';
import { supabase, fetchProducts, fetchTransactions, upsertProduct, logTransaction } from './services/supabaseService';
import { translations, Language } from './translations';

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

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(true);

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

  const profileRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with Supabase on Mount
  useEffect(() => {
    const initData = async () => {
      setIsLoadingDB(true);
      const p = await fetchProducts();
      const tx = await fetchTransactions();
      if (p.length > 0) setProducts(p);
      if (tx.length > 0) setTransactions(tx);
      setIsLoadingDB(false);
    };

    initData();

    // Set up Realtime Subscriptions
    const productSub = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', table: 'products' }, async () => {
        const updated = await fetchProducts();
        setProducts(updated);
      })
      .on('postgres_changes', { event: 'INSERT', table: 'transactions' }, async () => {
        const updated = await fetchTransactions();
        setTransactions(updated);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productSub);
    };
  }, []);

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

  const handleWelcomeFinish = () => {
    sessionStorage.setItem('ps_telecom_welcome_seen', 'true');
    setShowWelcome(false);
  };

  const playChaChing = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current!;
      if (ctx.state === 'suspended') ctx.resume();
      
      const now = ctx.currentTime;
      
      // Primary Chime Tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      // Higher Harmonic (The "Ring")
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1760, now + 0.08); // A6
      gain2.gain.setValueAtTime(0, now + 0.08);
      gain2.gain.linearRampToValueAtTime(0.08, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc1.start(now);
      osc1.stop(now + 0.5);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.6);
    } catch (e) {
      console.warn("Audio feedback failed:", e);
    }
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

  const processStockTransaction = async (productId: string, amount: number, reason: string, newBoxNumber?: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const newQty = stockActionType === TransactionType.IN 
      ? product.quantity + amount 
      : Math.max(0, product.quantity - amount);

    // Play "Product Sell Out Tune" when stock goes out
    if (stockActionType === TransactionType.OUT && amount > 0) playChaChing();
    
    const updatedProduct = { 
      ...product, 
      quantity: newQty, 
      boxNumber: newBoxNumber || product.boxNumber,
      lastUpdated: Date.now() 
    };

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

    try {
      await upsertProduct(updatedProduct);
      await logTransaction(newTx);
      // Optimistic update
      setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
      setTransactions(prev => [newTx, ...prev]);
    } catch (e) {
      alert("Cloud Sync Error. Please check connection.");
    }

    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const saveProduct = async (data: Partial<Product>) => {
    let finalProduct: Product;
    if (selectedProduct) {
      finalProduct = { ...selectedProduct, ...data, lastUpdated: Date.now() } as Product;
    } else {
      finalProduct = {
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
    }

    try {
      await upsertProduct(finalProduct);
      setProducts(prev => selectedProduct 
        ? prev.map(p => p.id === selectedProduct.id ? finalProduct : p) 
        : [...prev, finalProduct]
      );
    } catch (e) {
      alert("Failed to save to cloud.");
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

  useEffect(() => { if (isOnline && !showWelcome && products.length > 0) runAnalysis(); }, [products.length, isOnline, lang, showWelcome]);

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
      <input type="file" ref={fileInputRef} className="hidden" />

      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col p-4 shrink-0 shadow-xl">
        <div className="flex items-center gap-3 px-2 mb-10 mt-2">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
             <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <span className="text-white font-black text-xl tracking-tight">PS Telecom</span>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} /></svg>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <header className="h-20 md:h-24 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 md:px-10 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4">
             <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight hidden sm:block">
                {activeTab === 'analysis' ? t.analysis : navItems.find(n => n.id === activeTab)?.label}
              </h2>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isLoadingDB ? 'bg-blue-500 animate-bounce' : isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isLoadingDB ? 'Syncing...' : isOnline ? 'Cloud Active' : 'Offline'}</p>
              </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={openFinder} className="p-3 text-slate-500 bg-slate-100 rounded-2xl hover:bg-slate-200 shadow-sm transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
            <button onClick={() => openProductForm()} className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-lg active:scale-95 transition-all" title={t.addProduct}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </button>
            <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 font-bold border-2 border-white shadow-sm transition-all">PS</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-40 md:pb-24 p-4 md:p-10 max-w-7xl mx-auto w-full">
          {isLoadingDB ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
              <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="font-bold text-sm uppercase tracking-widest">Waking up PS Telecom Cloud...</p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <Dashboard products={products} stats={stats} lang={lang} />}
              {activeTab === 'inventory' && <InventoryTable products={products} onStockAction={(id, type) => openStockAction(type as TransactionType, products.find(p => p.id === id))} onEdit={(p) => openProductForm(p)} lang={lang} />}
              {activeTab === 'history' && <HistoryLog transactions={transactions} lang={lang} />}
              {activeTab === 'analysis' && <AIAnalysis data={aiAnalysis} isLoading={isGeneratingInsights} onRefresh={runAnalysis} isOnline={isOnline} lang={lang} />}
            </>
          )}
        </div>

        {/* Floating Quick Action Bar at Bottom Middle */}
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 p-2 bg-white/90 backdrop-blur-xl rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-blue-500/15 animate-in slide-in-from-bottom-8 duration-500">
          <button 
            onClick={() => openStockAction(TransactionType.IN)}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all group"
          >
            <div className="bg-white/20 p-1 rounded-full group-hover:rotate-90 transition-transform">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M12 4v16m8-8H4" /></svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest">{t.stockIn}</span>
          </button>
          
          <div className="w-px h-6 bg-slate-200" />
          
          <button 
            onClick={() => openStockAction(TransactionType.OUT)}
            className="flex items-center gap-2 px-5 py-3 bg-amber-500 text-white rounded-full hover:bg-amber-600 shadow-lg shadow-amber-500/25 active:scale-95 transition-all group"
          >
            <div className="bg-white/20 p-1 rounded-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M20 12H4" /></svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest">{t.stockOut}</span>
          </button>
        </div>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 h-20 flex items-center justify-around px-4 z-40">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${activeTab === item.id ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
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
            <div className="p-8 md:p-10 overflow-y-auto">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                    {modalType === 'STOCK_ACTION' ? `${stockActionType === TransactionType.IN ? t.stockIn : t.stockOut}` : (modalType === 'FIND_PRODUCT' ? t.quickFind : (selectedProduct ? t.editProduct : t.addProduct))}
                  </h3>
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
                    {!selectedProduct ? (
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.tableHeaderProduct}</label>
                        <select name="productId" required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl appearance-none font-bold text-slate-800 focus:border-blue-500/30 outline-none transition-all" onChange={(e) => setSelectedProduct(products.find(prod => prod.id === e.target.value) || null)}>
                          <option value="">Select Product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} • {p.sku}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Selected Product</p>
                        <p className="font-bold text-slate-800">{selectedProduct.name}</p>
                        <input type="hidden" name="productId" value={selectedProduct.id} />
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div>
                          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.tableHeaderStock}</label>
                          <input name="amount" type="number" required min="1" className={`w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-2xl font-black focus:outline-none transition-all ${stockActionType === TransactionType.IN ? 'focus:border-emerald-500/30 text-emerald-600' : 'focus:border-amber-500/30 text-amber-600'}`} placeholder="0" autoFocus />
                       </div>
                       <div>
                          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.boxNumber}</label>
                          <input name="newBoxNumber" type="text" defaultValue={selectedProduct?.boxNumber} className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500/30 outline-none transition-all" />
                       </div>
                    </div>
                    <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.reason}</label>
                        <input name="reason" type="text" required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500/30 outline-none transition-all" placeholder="e.g. Sales, Return, Damaged" />
                    </div>
                  </div>
                  <div className="flex gap-4 mt-12">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-5 text-slate-400 font-black uppercase text-xs">{t.dismiss}</button>
                    <button type="submit" className={`flex-1 px-6 py-5 text-white font-black uppercase text-xs rounded-2xl shadow-xl transition-all active:scale-95 ${stockActionType === TransactionType.IN ? 'bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-600' : 'bg-amber-500 shadow-amber-500/30 hover:bg-amber-600'}`}>{t.commit}</button>
                  </div>
                </form>
              ) : modalType === 'FIND_PRODUCT' ? (
                <div className="space-y-6">
                  <input autoFocus type="text" className="w-full pl-6 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[30px] text-xl font-bold outline-none focus:border-blue-500/30 transition-all" placeholder={t.searchPlaceholder} value={finderQuery} onChange={(e) => setFinderQuery(e.target.value)} />
                  <div className="divide-y divide-slate-100">
                    {filteredFinderProducts.map(p => (
                      <div key={p.id} className="py-5 flex items-center justify-between">
                        <div>
                          <p className="font-black text-slate-900">{p.name}</p>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">{p.sku}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openStockAction(TransactionType.IN, p)} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl font-black text-xl hover:bg-emerald-500 hover:text-white transition-all">+</button>
                          <button onClick={() => openStockAction(TransactionType.OUT, p)} className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl font-black text-xl hover:bg-amber-500 hover:text-white transition-all">-</button>
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
                        <input name="name" defaultValue={selectedProduct?.name} required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500/30 outline-none transition-all" placeholder="e.g. iPhone 15 Pro Max" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.sku}</label>
                        <input name="sku" defaultValue={selectedProduct?.sku} required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-mono focus:border-blue-500/30 outline-none transition-all" placeholder="e.g. SKU-1001" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.category}</label>
                        <input name="category" defaultValue={selectedProduct?.category} required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500/30 outline-none transition-all" placeholder="e.g. Mobile" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.boxNumber}</label>
                        <input name="boxNumber" defaultValue={selectedProduct?.boxNumber} required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500/30 outline-none transition-all" placeholder="e.g. B-12" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.minAlert}</label>
                        <input name="threshold" type="number" defaultValue={selectedProduct?.minThreshold} required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500/30 outline-none transition-all" placeholder="e.g. 5" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">{t.costPrice}</label>
                          <button 
                            type="button" 
                            onClick={() => setFormShowCost(!formShowCost)} 
                            className="text-[9px] font-black text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-colors"
                          >
                            {formShowCost ? 'Hide' : 'Show'}
                          </button>
                        </div>
                        <input 
                          name="purchasePrice" 
                          type={formShowCost ? "number" : "password"} 
                          step="0.01" 
                          defaultValue={selectedProduct?.purchasePrice} 
                          required 
                          className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500/30 outline-none transition-all" 
                          placeholder="0.00" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.sellPrice}</label>
                        <input name="sellingPrice" type="number" step="0.01" defaultValue={selectedProduct?.sellingPrice} required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500/30 outline-none transition-all" placeholder="0.00" />
                      </div>
                    </div>
                    {!selectedProduct && (
                      <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.initialQty}</label>
                        <input name="initialStock" type="number" required className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-blue-500/30 outline-none transition-all" placeholder="0" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 mt-12">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-5 text-slate-400 font-black uppercase text-xs hover:text-slate-900 transition-colors">{t.cancel}</button>
                    <button type="submit" className="flex-1 px-6 py-5 bg-blue-600 text-white font-black uppercase text-xs rounded-2xl shadow-xl shadow-blue-500/30 transition-all active:scale-95">{t.save}</button>
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
