import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, AlertCircle, Clock3, Download, Loader2, RefreshCw, Search, SlidersHorizontal, WalletCards } from 'lucide-react';
import { getErrorMessage, getTransactionHistory } from '../services/api';

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const filters = ['All activity', 'Completed', 'Processing', 'Failed'];

export default function Transactions({ account }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All activity');

  const refresh = useCallback(async () => {
    if (!account?.accountNumber) {
      setTransactions([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await getTransactionHistory(account.accountNumber);
      setTransactions(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not load transaction history.'));
    } finally {
      setLoading(false);
    }
  }, [account?.accountNumber]);

  useEffect(() => { refresh(); }, [refresh]);

  const visibleTransactions = useMemo(() => transactions.filter((item) => {
    const matchesStatus = filter === 'All activity' || item.status === filter.toUpperCase();
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      item.description,
      item.referenceNumber,
      item.id,
      item.receiverAccountNumber,
      item.senderAccountNumber,
      item.status,
    ].some((value) => String(value || '').toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  }), [filter, search, transactions]);

  const downloadCsv = () => {
    const header = ['Date', 'Reference', 'Description', 'Type', 'Amount (INR)', 'Status'];
    const rows = visibleTransactions.map((item) => [
      item.createdAt || '',
      item.referenceNumber || item.id || '',
      item.description || '',
      item.type || '',
      item.amount || '',
      item.status || '',
    ]);
    const csv = [header, ...rows].map((row) => row.map((field) => `"${String(field).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `northstar-transactions-${account?.accountNumber || 'demo'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack">
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR MONEY, ACCOUNTED FOR</div>
          <h1 className="page-title">Activity, at a glance.</h1>
          <p className="page-subtitle">A complete record of money sent from and received by your connected account.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="button button-quiet" onClick={downloadCsv} disabled={!visibleTransactions.length}><Download size={16} /> Export CSV</button>
          <button type="button" className="button button-primary" onClick={refresh} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} size={16} /> Refresh</button>
        </div>
      </section>

      {error && <div className="notice notice-error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}

      {!account ? (
        <div className="card-surface empty-state large-empty"><div className="empty-icon"><WalletCards size={22} /></div><strong>Connect an account to see activity</strong><span>Your transaction history appears here once you select an account.</span><Link className="button button-primary" to="/accounts">Go to accounts <ArrowRight size={16} /></Link></div>
      ) : (
        <>
          <section className="transaction-toolbar card-surface">
            <div className="transaction-account-summary">
              <span className="account-avatar-small">{account.accountHolderName?.slice(0, 1)?.toUpperCase() || 'A'}</span>
              <div><strong>{account.accountHolderName}</strong><span>•••• {account.accountNumber.slice(-4)} · {transactions.length} transaction{transactions.length === 1 ? '' : 's'}</span></div>
            </div>
            <div className="transaction-controls">
              <label className="search-control"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search activity" aria-label="Search transaction activity" /></label>
              <label className="filter-control"><SlidersHorizontal size={15} /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by status">{filters.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
          </section>

          <section className="card-surface activity-table-card">
            {loading ? (
              <div className="loading-state"><Loader2 className="spin" size={24} /><span>Loading your activity…</span></div>
            ) : visibleTransactions.length === 0 ? (
              <div className="empty-state table-empty"><div className="empty-icon">{transactions.length ? <Search size={22} /> : <Clock3 size={22} />}</div><strong>{transactions.length ? 'No matching activity' : 'Nothing here yet'}</strong><span>{transactions.length ? 'Try another search or status filter.' : 'Make your first transfer and it will appear here.'}</span>{!transactions.length && <Link className="button button-quiet" to="/transfer">Start a transfer</Link>}</div>
            ) : (
              <div className="table-scroll">
                <table className="activity-table">
                  <thead><tr><th>TRANSACTION</th><th>REFERENCE</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th><th /></tr></thead>
                  <tbody>
                    {visibleTransactions.map((item) => {
                      const outgoing = item.senderAccountNumber === account.accountNumber;
                      return (
                        <tr key={item.id}>
                          <td><div className="table-transaction"><span className={`activity-type-icon ${outgoing ? 'outgoing' : 'incoming'}`}>{outgoing ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}</span><div><strong>{item.description || (outgoing ? 'Transfer sent' : 'Transfer received')}</strong><span>{outgoing ? `To ${item.receiverAccountNumber}` : `From ${item.senderAccountNumber}`}</span></div></div></td>
                          <td className="mono reference-cell">{item.referenceNumber || item.id}</td>
                          <td className="date-cell">{item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                          <td className={`table-amount ${outgoing ? 'amount-out' : 'amount-in'}`}>{outgoing ? '−' : '+'}{money(item.amount)}</td>
                          <td><span className={`status-label ${String(item.status || '').toLowerCase()}`}>{item.status || 'UNKNOWN'}</span></td>
                          <td><span className="type-chip">{item.type || 'TRANSFER'}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && visibleTransactions.length > 0 && <div className="table-footer"><span>Showing {visibleTransactions.length} of {transactions.length} transactions</span><button type="button" className="text-button" onClick={refresh}><RefreshCw size={14} /> Sync latest</button></div>}
          </section>
          <div className="activity-disclaimer"><AlertCircle size={14} /> History includes transfers where the selected account is either the sender or recipient.</div>
        </>
      )}
    </div>
  );
}
