import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Transfer from './pages/Transfer';
import Payment from './pages/Payment';
import Transactions from './pages/Transactions';

const ACCOUNT_STORAGE_KEY = 'digital-bank.account';

function readSavedAccount() {
  try {
    const savedAccount = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    return savedAccount ? JSON.parse(savedAccount) : null;
  } catch {
    localStorage.removeItem(ACCOUNT_STORAGE_KEY);
    return null;
  }
}

export default function App() {
  const [account, setAccount] = useState(readSavedAccount);
  const [sidebarVisible, setSidebarVisible] = useState(() => localStorage.getItem('digital-bank.sidebar-hidden') !== 'true');

  useEffect(() => {
    if (account) {
      localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account));
    } else {
      localStorage.removeItem(ACCOUNT_STORAGE_KEY);
    }
  }, [account]);

  useEffect(() => {
    localStorage.setItem('digital-bank.sidebar-hidden', String(!sidebarVisible));
  }, [sidebarVisible]);

  const selectAccount = useCallback((nextAccount) => setAccount(nextAccount), []);
  const toggleSidebar = () => setSidebarVisible((visible) => !visible);

  return (
    <BrowserRouter>
      <div className={`app-shell${sidebarVisible ? '' : ' sidebar-hidden'}`}>
        <Header account={account} onClearAccount={() => setAccount(null)} sidebarVisible={sidebarVisible} onToggleSidebar={toggleSidebar} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard account={account} onSelectAccount={selectAccount} />} />
            <Route path="/accounts" element={<Accounts account={account} onSelectAccount={selectAccount} />} />
            <Route path="/transfer" element={<Transfer account={account} />} />
            <Route path="/payment" element={<Payment account={account} />} />
            <Route path="/transactions" element={<Transactions account={account} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="app-footer">
          <span>Digital Bank · Local demonstration environment</span>
          <span>Never use real financial or personal data in this demo.</span>
        </footer>
      </div>
    </BrowserRouter>
  );
}
