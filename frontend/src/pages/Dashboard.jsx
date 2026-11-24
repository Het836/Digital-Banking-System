import { useCallback, useEffect, useRef, useState } from 'react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowLeftRight,
  ArrowUpRight,
  CircleDollarSign,
  CreditCard,
  Landmark,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
  Zap,
} from 'lucide-react';
import { checkServiceHealth, getAccount, getErrorMessage, getTransactionHistory } from '../services/api';

const serviceList = [
  ['gateway', 'API Gateway', 'Routing & rate limits'],
  ['account', 'Account Service', 'Accounts & balances'],
  ['transaction', 'Transaction Service', 'Transfers & history'],
  ['payment', 'Payment Service', 'Razorpay orders'],
  ['fraud', 'Fraud Detection', 'Risk monitoring'],
  ['notification', 'Notification Service', 'Event notifications'],
];

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

const readableDate = (value) => value
  ? new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
  : '—';

const activityRanges = [
  { key: '24H', label: '24H' },
  { key: '7D', label: '7D' },
  { key: '30D', label: '30D' },
  { key: 'ALL', label: 'All time' },
];

function getActivityBuckets(transactions, accountNumber, range) {
  const now = new Date();
  const outgoing = transactions
    .filter((transaction) => transaction.senderAccountNumber === accountNumber)
    .map((transaction) => ({ transaction, date: new Date(transaction.createdAt) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()));
  let start;
  let end;
  let count;

  if (range === '24H') {
    end = now;
    start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    count = 6;
  } else if (range === '7D') {
    end = new Date(now);
    end.setHours(24, 0, 0, 0);
    start = new Date(end);
    start.setDate(start.getDate() - 7);
    count = 7;
  } else if (range === '30D') {
    end = new Date(now);
    end.setHours(24, 0, 0, 0);
    start = new Date(end);
    start.setDate(start.getDate() - 30);
    count = 6;
  } else {
    const earliest = outgoing.reduce((oldest, item) => item.date < oldest ? item.date : oldest, now);
    start = new Date(earliest);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
    end.setHours(24, 0, 0, 0);
    if (end.getTime() - start.getTime() < 24 * 60 * 60 * 1000) start.setDate(start.getDate() - 1);
    count = 6;
  }

  const bucketDuration = (end.getTime() - start.getTime()) / count;
  return Array.from({ length: count }, (_, index) => {
    const bucketStart = new Date(start.getTime() + bucketDuration * index);
    const bucketEnd = new Date(start.getTime() + bucketDuration * (index + 1));
    const amount = outgoing.reduce((sum, item) => (
      item.date >= bucketStart && item.date < bucketEnd ? sum + Number(item.transaction.amount || 0) : sum
    ), 0);
    const label = range === '24H'
      ? bucketStart.toLocaleTimeString('en', { hour: 'numeric' })
      : range === '7D'
        ? bucketStart.toLocaleDateString('en', { weekday: 'short' })
        : bucketStart.toLocaleDateString('en', { month: 'short', day: 'numeric' });

    return { key: `${range}-${index}`, label, amount, isCurrent: index === count - 1 };
  });
}

export default function Dashboard({ account, onSelectAccount }) {
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber || '');
  const [transactions, setTransactions] = useState([]);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [error, setError] = useState('');
  const [services, setServices] = useState({});
  const [checkingServices, setCheckingServices] = useState(false);
  const [activityRange, setActivityRange] = useState('7D');
  const [showAllActivity, setShowAllActivity] = useState(false);
  const lastLoadedAccount = useRef(null);

  const refreshServices = useCallback(async () => {
    setCheckingServices(true);
    const results = await Promise.all(serviceList.map(async ([key]) => {
      try {
        const response = await checkServiceHealth(key);
        return [key, response.data?.status === 'UP' ? 'UP' : 'DEGRADED'];
      } catch {
        return [key, 'DOWN'];
      }
    }));
    setServices(Object.fromEntries(results));
    setCheckingServices(false);
  }, []);

  const loadAccount = useCallback(async (number) => {
    if (!number?.trim()) return;
    setLoadingAccount(true);
    setError('');
    try {
      const [accountResponse, historyResponse] = await Promise.all([
        getAccount(number.trim()),
        getTransactionHistory(number.trim()).catch(() => ({ data: [] })),
      ]);
      lastLoadedAccount.current = accountResponse.data.accountNumber;
      onSelectAccount(accountResponse.data);
      setAccountNumber(accountResponse.data.accountNumber);
      setTransactions(Array.isArray(historyResponse.data) ? historyResponse.data : []);
      setShowAllActivity(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not load this account. Check the number and try again.'));
    } finally {
      setLoadingAccount(false);
    }
  }, [onSelectAccount]);

  useEffect(() => {
    refreshServices();
  }, [refreshServices]);

  useEffect(() => {
    if (account?.accountNumber && lastLoadedAccount.current !== account.accountNumber) {
      loadAccount(account.accountNumber);
    }
  }, [account?.accountNumber, loadAccount]);

  const completedCount = transactions.filter((item) => item.status === 'COMPLETED').length;
  const activityBuckets = useMemo(
    () => getActivityBuckets(transactions, account?.accountNumber, activityRange),
    [transactions, account?.accountNumber, activityRange],
  );
  const maxActivityAmount = Math.max(...activityBuckets.map((item) => item.amount), 0);
  const rangeOutflow = activityBuckets.reduce((sum, item) => sum + item.amount, 0);
  const hasActivityInRange = rangeOutflow > 0;
  const visibleActivity = transactions.slice(0, showAllActivity ? 30 : 5);
  const amountMoved = transactions
    .filter((item) => item.senderAccountNumber === account?.accountNumber)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const upCount = Object.values(services).filter((status) => status === 'UP').length;

  return (
    <div className="page-stack">
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> PERSONAL BANKING OVERVIEW</div>
          <h1 className="page-title">Good to see you{account?.accountHolderName ? `, ${account.accountHolderName.split(' ')[0]}` : ''}.</h1>
          <p className="page-subtitle">A clear view of your money, right where it belongs.</p>
        </div>
        <div className="welcome-actions">
          <Link className="button button-quiet" to="/accounts"><Landmark size={16} /> Accounts</Link>
          <Link className="button button-primary" to="/transfer"><ArrowUpRight size={16} /> New transfer</Link>
        </div>
      </section>

      <section className="overview-grid">
        <article className="balance-panel">
          <div className="balance-panel-glow" />
          <div className="balance-topline">
            <div className="balance-label"><span className="balance-icon"><WalletCards size={17} /></span> TOTAL AVAILABLE BALANCE</div>
            <span className="balance-live"><span className="status-dot online" /> LIVE</span>
          </div>
          {account ? (
            <>
              <div className="balance-amount">{money(account.balance)}</div>
              <div className="balance-foot">
                <span>{account.accountType?.replace('_', ' ') || 'SAVINGS'} ACCOUNT</span>
                <span className="balance-account">•••• •••• {account.accountNumber?.slice(-4)}</span>
              </div>
            </>
          ) : (
            <div className="balance-empty">
              <strong>Start with your account</strong>
              <span>Connect an account below to see your live balance.</span>
            </div>
          )}
          <div className="balance-decoration"><span /><span /><span /></div>
        </article>

        <article className="account-connect card-surface">
          <div className="section-heading">
            <div className="section-icon icon-violet"><Search size={17} /></div>
            <div><h2>Quick account lookup</h2><p>Connect an account to get started</p></div>
          </div>
          <form className="lookup-form" onSubmit={(event) => { event.preventDefault(); loadAccount(accountNumber); }}>
            <label className="field-label" htmlFor="accountLookup">Account number</label>
            <div className="input-with-action">
              <input
                id="accountLookup"
                className="text-input"
                inputMode="numeric"
                autoComplete="off"
                value={accountNumber}
                onChange={(event) => setAccountNumber(event.target.value)}
                placeholder="Enter account number"
              />
              <button className="square-button" type="submit" disabled={loadingAccount || !accountNumber.trim()} aria-label="Look up account">
                {loadingAccount ? <RefreshCw className="spin" size={17} /> : <ArrowRight size={17} />}
              </button>
            </div>
            {error && <p className="inline-error" role="alert">{error}</p>}
          </form>
          <Link to="/accounts" className="text-link">Create a new demo account <ArrowRight size={14} /></Link>
        </article>
      </section>

      <section className="metric-grid">
        <article className="metric-card card-surface">
          <div className="metric-icon icon-green"><CircleDollarSign size={19} /></div>
          <div className="metric-caption">RECENT OUTFLOW</div>
          <strong>{money(amountMoved)}</strong>
          <span className="metric-note">From outgoing transfer history</span>
        </article>
        <article className="metric-card card-surface">
          <div className="metric-icon icon-blue"><ArrowLeftRight size={19} /></div>
          <div className="metric-caption">RECENT ACTIVITY</div>
          <strong>{transactions.length.toString().padStart(2, '0')} <small>transactions</small></strong>
          <span className="metric-note">{completedCount} completed successfully</span>
        </article>
        <article className="metric-card card-surface">
          <div className="metric-icon icon-amber"><ShieldCheck size={19} /></div>
          <div className="metric-caption">ACCOUNT STATUS</div>
          <strong className="metric-status">{account?.status || 'Not connected'}</strong>
          <span className="metric-note">Fraud checks active on transfers</span>
        </article>
      </section>

      <section className="dashboard-lower-grid">
        <article className="card-surface activity-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">YOUR MONEY, IN MOTION</div><h2>Recent activity</h2></div>
            {transactions.length > 5 && (
              <button
                type="button"
                className="text-link activity-view-all"
                onClick={() => setShowAllActivity((expanded) => !expanded)}
              >
                {showAllActivity
                  ? 'Show less'
                  : `View all${transactions.length > 30 ? ' (30)' : ` (${transactions.length})`}`}
                <ArrowRight className={showAllActivity ? 'activity-expand-icon expanded' : 'activity-expand-icon'} size={14} />
              </button>
            )}
          </div>
          {!account ? (
            <div className="empty-state"><div className="empty-icon"><ReceiptIcon /></div><strong>No account connected</strong><span>Look up an account above to see recent transactions.</span></div>
          ) : (
            <>
              <div className="activity-chart-wrap">
                <div className="activity-chart-heading">
                  <div><strong>Transfer volume</strong><span>Outgoing transfers · {activityRanges.find((range) => range.key === activityRange)?.label}</span></div>
                  <div className="activity-chart-controls">
                    <div className="activity-range-picker" aria-label="Activity chart time range">
                      {activityRanges.map((range) => (
                        <button
                          key={range.key}
                          type="button"
                          className={`activity-range-button${activityRange === range.key ? ' active' : ''}`}
                          onClick={() => setActivityRange(range.key)}
                          aria-pressed={activityRange === range.key}
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>
                    <span className="chart-total">{money(rangeOutflow)}</span>
                  </div>
                </div>
                <div className="activity-chart" style={{ gridTemplateColumns: `repeat(${activityBuckets.length}, minmax(0, 1fr))` }} role="img" aria-label={`Outgoing transfer amounts for ${activityRange === 'ALL' ? 'all time' : `the last ${activityRange}`}`}>
                  {activityBuckets.map((bucket) => {
                    const height = maxActivityAmount ? Math.max(6, Math.round((bucket.amount / maxActivityAmount) * 100)) : 5;
                    return (
                      <div className="chart-column" key={bucket.key}>
                        <div className="chart-bar-track"><span className={`chart-bar${bucket.isCurrent ? ' current' : ''}${bucket.amount ? '' : ' zero'}`} style={{ height: `${height}%` }} title={`${bucket.label}: ${money(bucket.amount)}`} /></div>
                        <span className={`chart-month-label${bucket.isCurrent ? ' current' : ''}`}>{bucket.label}</span>
                      </div>
                    );
                  })}
                  {!hasActivityInRange && <div className="chart-empty-message"><span className="chart-empty-icon"><CreditCard size={16} /></span><strong>No outgoing transfers in this range</strong><span>Choose another time range or make a transfer.</span></div>}
                </div>
              </div>
              <div className="activity-list">
                {visibleActivity.map((transaction) => {
                  const outgoing = transaction.senderAccountNumber === account.accountNumber;
                  return (
                    <div className="activity-row" key={transaction.id}>
                      <span className={`activity-type-icon ${outgoing ? 'outgoing' : 'incoming'}`}>
                        {outgoing ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}
                      </span>
                      <div className="activity-main">
                        <strong>{transaction.description || (outgoing ? 'Transfer sent' : 'Transfer received')}</strong>
                        <span>{outgoing ? `To ${transaction.receiverAccountNumber}` : `From ${transaction.senderAccountNumber}`} · {readableDate(transaction.createdAt)}</span>
                      </div>
                      <div className="activity-amount">
                        <strong className={outgoing ? 'amount-out' : 'amount-in'}>{outgoing ? '−' : '+'}{money(transaction.amount)}</strong>
                        <span className={`status-label ${String(transaction.status || '').toLowerCase()}`}>{transaction.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </article>

        <article className="card-surface service-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">SYSTEM HEALTH</div><h2>Services</h2></div>
            <button type="button" className="icon-button refresh-button" onClick={refreshServices} disabled={checkingServices} aria-label="Refresh service status">
              <RefreshCw className={checkingServices ? 'spin' : ''} size={16} />
            </button>
          </div>
          <div className="service-summary">
            <span className={`service-summary-dot ${upCount === serviceList.length ? 'all-good' : ''}`} />
            <strong>{upCount}/{serviceList.length} services operational</strong>
            <span>Local environment</span>
          </div>
          <div className="service-list">
            {serviceList.map(([key, name, description]) => (
              <div className="service-row" key={key}>
                <span className={`service-dot ${services[key] === 'UP' ? 'up' : services[key] === 'DOWN' ? 'down' : 'pending'}`} />
                <div><strong>{name}</strong><span>{description}</span></div>
                <span className={`service-state ${String(services[key] || 'CHECKING').toLowerCase()}`}>{services[key] || 'CHECKING'}</span>
              </div>
            ))}
          </div>
          <div className="service-footnote"><Zap size={14} /> Health checks via local service endpoints</div>
        </article>
      </section>

      <section className="quick-actions">
        <div className="quick-actions-copy"><div className="eyebrow">MADE FOR MOMENTUM</div><h2>Make your next move.</h2><p>Everyday banking, minus the extra steps.</p></div>
        <div className="quick-action-links">
          <Link to="/transfer" className="quick-action"><span className="quick-action-icon icon-blue"><ArrowUpRight size={18} /></span><span><strong>Send money</strong><small>Move funds securely</small></span><ArrowRight size={16} /></Link>
          <Link to="/payment" className="quick-action"><span className="quick-action-icon icon-violet"><CreditCard size={18} /></span><span><strong>Make a payment</strong><small>Checkout with Razorpay</small></span><ArrowRight size={16} /></Link>
        </div>
      </section>
    </div>
  );
}

function ReceiptIcon() {
  return <CreditCard size={22} />;
}
