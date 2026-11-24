import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, BadgeCheck, AlertCircle, Clock3, Loader2, LockKeyhole, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { getErrorMessage, getTransaction, transfer, verifyTransaction } from '../services/api';

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

export default function Transfer({ account }) {
  const [form, setForm] = useState({ receiverAccountNumber: '', amount: '', description: '' });
  const [transaction, setTransaction] = useState(null);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const updateForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const sendTransfer = async (event) => {
    event.preventDefault();
    if (!account?.accountNumber) return;
    setLoading(true);
    setError('');
    setMessage('');
    setTransaction(null);
    try {
      const response = await transfer({
        senderAccountNumber: account.accountNumber,
        receiverAccountNumber: form.receiverAccountNumber.trim(),
        amount: Number(form.amount),
        description: form.description.trim(),
      });
      setTransaction(response.data);
      setMessage('Transfer submitted. The services are processing it now.');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'The transfer could not be submitted.'));
    } finally {
      setLoading(false);
    }
  };

  const refreshTransaction = async () => {
    if (!transaction?.id) return;
    setRefreshing(true);
    setError('');
    try {
      const response = await getTransaction(transaction.id);
      setTransaction(response.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not refresh the transfer status.'));
    } finally {
      setRefreshing(false);
    }
  };

  const submitOtp = async (event) => {
    event.preventDefault();
    if (!transaction?.id || !otp.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await verifyTransaction(transaction.id, otp.trim());
      setTransaction(response.data);
      setOtp('');
      setMessage('Verification submitted. The transaction status has been updated.');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'The verification code was not accepted.'));
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
    return (
      <div className="page-stack">
        <PageIntro />
        <div className="card-surface empty-state large-empty"><div className="empty-icon"><ArrowLeftRight size={22} /></div><strong>Connect an account first</strong><span>Select or create a demo account to send a transfer.</span><Link className="button button-primary" to="/accounts">Go to accounts <ArrowRight size={16} /></Link></div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageIntro />
      {error && <div className="notice notice-error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      {message && <div className="notice notice-success" role="status"><BadgeCheck size={18} /><span>{message}</span></div>}

      <div className="transfer-layout">
        <section className="card-surface transfer-form-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">ACCOUNT TO ACCOUNT</div><h2>Send a transfer</h2></div>
            <span className="section-icon icon-blue"><Send size={17} /></span>
          </div>
          <div className="transfer-from">
            <span className="transfer-avatar">{account.accountHolderName?.slice(0, 1)?.toUpperCase() || 'A'}</span>
            <div><small>FROM YOUR ACCOUNT</small><strong>{account.accountHolderName}</strong><span>•••• {account.accountNumber.slice(-4)}</span></div>
            <span className="account-status-chip"><span className="status-dot online" /> {account.status || 'ACTIVE'}</span>
          </div>
          <form onSubmit={sendTransfer} className="form-grid">
            <div className="field-group field-span-2 recipient-input">
              <label className="field-label" htmlFor="receiverAccountNumber">Recipient account number</label>
              <div className="input-icon-wrap"><ArrowDownLeft size={17} /><input className="text-input" id="receiverAccountNumber" name="receiverAccountNumber" value={form.receiverAccountNumber} onChange={updateForm} placeholder="Enter the recipient's account number" inputMode="numeric" required /></div>
            </div>
            <div className="field-group field-span-2">
              <label className="field-label" htmlFor="amount">Amount to send <span>(INR)</span></label>
              <div className="currency-input amount-entry"><span>₹</span><input className="text-input" id="amount" name="amount" value={form.amount} onChange={updateForm} type="number" min="0.01" step="0.01" placeholder="0.00" required /></div>
              <small className="field-hint">Available balance: {money(account.balance)}</small>
            </div>
            <div className="field-group field-span-2">
              <label className="field-label" htmlFor="description">What's this for? <span>(optional)</span></label>
              <input className="text-input" id="description" name="description" value={form.description} onChange={updateForm} maxLength="120" placeholder="e.g. Dinner, rent, or just because" />
            </div>
            <button type="submit" className="button button-primary field-span-2 transfer-submit" disabled={loading}>
              {loading ? <Loader2 className="spin" size={17} /> : <ArrowLeftRight size={17} />}
              {loading ? 'Sending securely…' : 'Review and send'}
              {!loading && <ArrowRight size={16} className="button-end-icon" />}
            </button>
          </form>
          <div className="transfer-protection"><LockKeyhole size={15} /><span>Protected by fraud monitoring and OTP verification when needed.</span><ShieldCheck size={16} className="protection-check" /></div>
        </section>

        <aside className="transfer-side">
          <section className="transfer-preview card-surface">
            <div className="eyebrow">TRANSFER PREVIEW</div>
            <div className="preview-amount">{money(form.amount)}</div>
            <div className="preview-flow">
              <span className="flow-avatar">{account.accountHolderName?.slice(0, 1)?.toUpperCase() || 'A'}</span>
              <span className="flow-line"><i /><i /><i /></span>
              <span className="flow-avatar recipient">{form.receiverAccountNumber ? form.receiverAccountNumber.slice(-1) : '?'}</span>
            </div>
            <div className="preview-parties"><span>{account.accountHolderName?.split(' ')[0]}</span><span>{form.receiverAccountNumber ? `••${form.receiverAccountNumber.slice(-4)}` : 'Recipient'}</span></div>
            <div className="preview-fee"><span>Transfer fee</span><strong>₹0.00</strong></div>
            <div className="preview-fee total"><span>Total</span><strong>{money(form.amount)}</strong></div>
          </section>
          <section className="card-surface safety-card">
            <span className="section-icon icon-green"><ShieldCheck size={18} /></span>
            <h3>Built with safety in mind</h3>
            <p>Transactions are coordinated across independent account, transaction, fraud detection and notification services.</p>
            <div className="safety-tag"><span className="status-dot online" /> Fraud checks enabled</div>
          </section>
        </aside>
      </div>

      {transaction && (
        <section className="card-surface transaction-result">
          <div className="panel-heading">
            <div><div className="eyebrow">TRANSFER REFERENCE · {transaction.referenceNumber || transaction.id}</div><h2>Transfer status</h2></div>
            <button type="button" className="button button-quiet" onClick={refreshTransaction} disabled={refreshing}>
              <RefreshCw className={refreshing ? 'spin' : ''} size={15} /> Refresh status
            </button>
          </div>
          <div className="result-summary">
            <span className={`result-status-icon ${transaction.status === 'COMPLETED' ? 'icon-green' : transaction.status === 'FAILED' ? 'icon-red' : 'icon-amber'}`}>
              {transaction.status === 'COMPLETED' ? <BadgeCheck size={20} /> : <Clock3 size={20} />}
            </span>
            <div><strong>{transaction.status || 'PROCESSING'}</strong><span>{money(transaction.amount)} · ID {transaction.id}</span></div>
            <span className={`status-label ${String(transaction.status || '').toLowerCase()}`}>{transaction.status || 'PROCESSING'}</span>
          </div>
          {transaction.status === 'PROCESSING' && (
            <div className="otp-area">
              <div className="otp-explainer"><ShieldCheck size={17} /><span>If this transfer needs verification, enter the six-digit OTP sent by the Notification Service. In this local demo, check <code>docker compose logs notification-service</code>.</span></div>
              <form className="otp-form" onSubmit={submitOtp}>
                <input className="text-input otp-input" aria-label="One-time password" inputMode="numeric" autoComplete="one-time-code" maxLength="6" pattern="[0-9]{6}" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" />
                <button type="submit" className="button button-primary" disabled={loading || otp.length !== 6}>{loading ? 'Verifying…' : 'Verify transfer'} <ArrowRight size={16} /></button>
              </form>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function PageIntro() {
  return (
    <section className="welcome-row">
      <div>
        <div className="eyebrow"><span className="eyebrow-line" /> FAST, THOUGHTFUL TRANSFERS</div>
        <h1 className="page-title">Move money with confidence.</h1>
        <p className="page-subtitle">A secure transfer experience, powered by your local microservices.</p>
      </div>
    </section>
  );
}
