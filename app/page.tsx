'use client';

import { useState, useEffect } from 'react';
import { 
  collection, onSnapshot, doc, getDoc, setDoc, 
  serverTimestamp, query, orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { BLOX_FRUITS, BloxFruit } from '@/lib/blox-fruits';
import { Settings, Save, Plus, Package, Database, Activity, RefreshCw, Server } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [activeAccount, setActiveAccount] = useState<string>('');
  
  const [fruits, setFruits] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState(0);

  // Modals
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showManageFruit, setShowManageFruit] = useState(false);

  // Bot Config State
  const [discordConfig, setDiscordConfig] = useState({ appId: '', publicKey: '', botToken: '' });
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState('');

  // Fetch Accounts
  useEffect(() => {
    const q = query(collection(db, 'accounts'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const accs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setAccounts(accs);
      if (accs.length > 0 && !activeAccount) {
        setActiveAccount(accs[0].name);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'accounts'));
    
    return () => unsub();
  }, [activeAccount]);

  // Fetch Fruits for active account
  useEffect(() => {
    if (!activeAccount) return;
    const sanitizedVal = activeAccount.toLowerCase().replace(/[^a-z0-9]/g, '');
    const pathForFruits = `accounts/${sanitizedVal}/fruits`;
    
    const unsub = onSnapshot(collection(db, pathForFruits), (snap) => {
      const fts: any[] = [];
      let val = 0;
      snap.forEach(d => {
         const data = d.data();
         if (data.quantity > 0) {
            fts.push({ id: d.id, ...data });
            const baseFruit = BLOX_FRUITS.find(f => f.name.toLowerCase() === data.fruitName.toLowerCase());
            if (baseFruit) {
              val += (baseFruit.value * data.quantity);
            }
         }
      });
      setFruits(fts);
      setTotalValue(val);
    }, (error) => handleFirestoreError(error, OperationType.LIST, pathForFruits));

    return () => unsub();
  }, [activeAccount]);

  // Fetch Bot Config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'configs', 'discord'));
        if (snap.exists()) {
          setDiscordConfig(snap.data() as any);
        }
      } catch (e) {
        // Handle gracefully
      }
    };
    fetchConfig();
  }, []);

  const handleSaveDiscordConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'configs', 'discord'), {
        ...discordConfig
      });
      alert('Discord settings saved!');
    } catch (error) {
      console.error(error);
      alert('Failed to save settings.');
    }
  };

  const deployCommands = async () => {
    setIsDeploying(true);
    setDeployResult('');
    try {
      const res = await fetch('/api/discord/register-commands');
      const data = await res.json();
      if (res.ok) {
        setDeployResult('Commands deployed successfully globally!');
      } else {
        setDeployResult(`Error: ${data.error || 'Failed'}`);
      }
    } catch (e) {
      setDeployResult('Failed to deploy commands.');
    }
    setIsDeploying(false);
  };

  return (
    <div className="flex h-screen bg-[#0B0E14] text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111620] border-r border-slate-800 flex flex-col items-start px-4 py-8">
        <h1 className="text-xl font-bold tracking-tight text-blue-400 flex items-center gap-2 mb-8 px-2">
          <Database className="w-5 h-5" />
          Blox Tracker
        </h1>
        
        <nav className="flex flex-col gap-2 w-full">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <Activity className="w-4 h-4" />
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          >
            <Settings className="w-4 h-4" />
            Bot Settings
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {activeTab === 'overview' && (
          <div className="flex-1 overflow-y-auto p-8">
            <header className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Active Inventory</h2>
                <p className="text-slate-400 text-sm mt-1">Manage and track Blox Fruits across your accounts.</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowAddAccount(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Account
                </button>
                <button 
                  onClick={() => setShowManageFruit(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  Manage Fruits
                </button>
              </div>
            </header>

            {accounts.length > 0 ? (
              <>
                <div className="flex items-center gap-4 mb-8">
                   <select 
                     className="bg-[#111620] border border-slate-700 text-slate-200 text-sm rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[200px]"
                     value={activeAccount}
                     onChange={(e) => setActiveAccount(e.target.value)}
                   >
                     {accounts.map(acc => (
                       <option key={acc.id} value={acc.name}>{acc.name} (Lv. {acc.level})</option>
                     ))}
                   </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                   <div className="bg-[#111620] rounded-xl p-6 border border-slate-800 flex items-center gap-4">
                      <div className="bg-blue-500/10 p-4 rounded-full text-blue-400">
                        <Database className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-slate-400 text-sm font-medium">Total Inventory Value</h3>
                        <p className="text-3xl font-bold text-white mt-1">${totalValue.toLocaleString()}</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-200 border-b border-slate-800 pb-2">Stored Fruits</h3>
                  {fruits.length === 0 ? (
                    <div className="text-slate-500 text-sm py-8 text-center border border-dashed border-slate-800 rounded-xl">
                      No fruits found in this account&apos;s inventory.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {fruits.map(fruit => {
                        const baseFruit = BLOX_FRUITS.find(f => f.name.toLowerCase() === fruit.fruitName.toLowerCase());
                        const val = baseFruit ? baseFruit.value * fruit.quantity : 0;
                        return (
                          <div key={fruit.id} className="bg-[#111620] p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                            <h4 className="text-xl font-bold text-slate-100 mb-1">{fruit.fruitName}</h4>
                            <div className="flex justify-between items-center mt-4">
                               <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">x{fruit.quantity}</span>
                               <span className="text-sm font-medium text-blue-400">${val.toLocaleString()}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-[#111620] rounded-xl border border-dashed border-slate-800">
                 <Server className="w-10 h-10 mb-4 opacity-50" />
                 <p>No accounts tracked yet.</p>
                 <button onClick={() => setShowAddAccount(true)} className="mt-4 text-blue-500 hover:underline">Add one now</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-4xl">
             <header className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Discord Integration</h2>
                <p className="text-slate-400 text-sm mt-1">Configure your bot to sync and track inventory directly from Discord.</p>
             </header>

             <form onSubmit={handleSaveDiscordConfig} className="bg-[#111620] rounded-xl p-8 border border-slate-800 space-y-6">
               <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Application ID</label>
                  <input 
                    type="text" 
                    required
                    value={discordConfig.appId}
                    onChange={e => setDiscordConfig({...discordConfig, appId: e.target.value})}
                    placeholder="Enter your Discord Application ID..."
                    className="w-full bg-[#0B0E14] border border-slate-700 text-white text-sm rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Public Key</label>
                  <input 
                    type="text" 
                    required
                    value={discordConfig.publicKey}
                    onChange={e => setDiscordConfig({...discordConfig, publicKey: e.target.value})}
                    placeholder="Enter your Discord interactions public key..."
                    className="w-full bg-[#0B0E14] border border-slate-700 text-white text-sm rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Bot Token</label>
                  <input 
                    type="password" 
                    required
                    value={discordConfig.botToken}
                    onChange={e => setDiscordConfig({...discordConfig, botToken: e.target.value})}
                    placeholder="Discord Bot Token"
                    className="w-full bg-[#0B0E14] border border-slate-700 text-white text-sm rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
               </div>
               <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
                 <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                   <Save className="w-4 h-4" />
                   Save Configuration
                 </button>
                 <button 
                   type="button"
                   onClick={deployCommands}
                   disabled={isDeploying || !discordConfig.botToken || !discordConfig.appId}
                   className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isDeploying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                   Deploy Commands
                 </button>
               </div>
               {deployResult && (
                 <div className={`p-4 rounded-lg text-sm ${deployResult.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                   {deployResult}
                 </div>
               )}
             </form>
          </div>
        )}
      </main>

      {/* Add Account Modal */}
      {showAddAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <AddAccountModal 
              onClose={() => setShowAddAccount(false)} 
              onSuccess={(name) => {
                setShowAddAccount(false);
                setActiveAccount(name);
              }}
           />
        </div>
      )}

      {/* Manage Fruit Modal */}
      {showManageFruit && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <ManageFruitModal 
              accounts={accounts}
              activeAccount={activeAccount}
              onClose={() => setShowManageFruit(false)} 
           />
        </div>
      )}
    </div>
  );
}

function AddAccountModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: (name: string) => void }) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
       const sanitizedAccount = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
       await setDoc(doc(db, 'accounts', sanitizedAccount), {
         name: name.trim(),
         level: Number(level) || 1,
         createdAt: serverTimestamp(),
         updatedAt: serverTimestamp()
       });
       onSuccess(name.trim());
    } catch (e) {
      console.error(e);
      alert('Failed to add account. Check console.');
    }
    setLoading(false);
  };

  return (
    <div className="bg-[#0B0E14] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-slate-800">
         <h3 className="text-xl font-bold tracking-tight text-white">Add Tracking Account</h3>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
         <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Account Name</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#111620] border border-slate-700 text-white text-sm rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g. RIP_King123"
            />
         </div>
         <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Level</label>
            <input 
              type="number" 
              required
              min="1"
              value={level}
              onChange={e => setLevel(parseInt(e.target.value))}
              className="w-full bg-[#111620] border border-slate-700 text-white text-sm rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
         </div>
         <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button disabled={loading} type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
               {loading ? 'Adding...' : 'Add Account'}
            </button>
         </div>
      </form>
    </div>
  );
}

function ManageFruitModal({ onClose, accounts, activeAccount }: { onClose: () => void, accounts: any[], activeAccount: string }) {
  const [selectedAcc, setSelectedAcc] = useState(activeAccount || '');
  const [fruitName, setFruitName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAcc || !fruitName) return;
    setLoading(true);
    
    try {
       const sanitizedAccount = selectedAcc.toLowerCase().replace(/[^a-z0-9]/g, '');
       const sanitizedFruit = fruitName.toLowerCase().replace(/[^a-z0-9]/g, '');
       
       await setDoc(doc(db, 'accounts', sanitizedAccount, 'fruits', sanitizedFruit), {
         fruitName: fruitName.trim(),
         quantity: Number(quantity),
         updatedAt: serverTimestamp()
       }, { merge: true });
       
       onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to manage fruit. Check console.');
    }
    setLoading(false);
  };

  return (
    <div className="bg-[#0B0E14] border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-slate-800">
         <h3 className="text-xl font-bold tracking-tight text-white">Manage Fruit</h3>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
         <div>
             <label className="block text-sm font-medium text-slate-300 mb-2">Account</label>
             <select 
                required
                className="w-full bg-[#111620] border border-slate-700 text-white text-sm rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={selectedAcc}
                onChange={e => setSelectedAcc(e.target.value)}
             >
                <option value="" disabled>Select account...</option>
                {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
             </select>
         </div>
         <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Fruit</label>
            <input 
              type="text" 
              required
              list="bloxFruitsData"
              value={fruitName}
              onChange={e => setFruitName(e.target.value)}
              className="w-full bg-[#111620] border border-slate-700 text-white text-sm rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g. Kitsune"
            />
            <datalist id="bloxFruitsData">
              {BLOX_FRUITS.map(f => <option key={f.name} value={f.name}></option>)}
            </datalist>
         </div>
         <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Quantity</label>
            <input 
              type="number" 
              required
              min="0"
              value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value))}
              className="w-full bg-[#111620] border border-slate-700 text-white text-sm rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
         </div>
         <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button disabled={loading} type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
               {loading ? 'Saving...' : 'Save'}
            </button>
         </div>
      </form>
    </div>
  );
}
