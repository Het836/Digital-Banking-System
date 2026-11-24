import { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, Copy, Landmark, Loader2, PlusCircle, Search, ShieldCheck } from 'lucide-react';
import { createAccount, getAccount, getErrorMessage } from '../services/api';

const initialForm = {
  accountHolderName: '',
  email: '',
  phone: '',
  accountType: 'SAVING',
  initialDeposit: '2500',
};

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

export default function Accounts({ account, onSelectAccount }) {
  const [form, setForm] = useState(initialForm);
  const [lookupNumber, setLookupNumber] = useState(account?.accountNumber || '');
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => setLookupNumber(account?.accountNumber || ''), [account?.accountNumber]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await createAccount({ ...form, initialDeposit: Number(form.initialDeposit) });
      onSelectAccount(response.data);
      setLookupNumber(response.data.accountNumber);
      setSuccess(`Your demo account is ready. Account number: ${response.data.accountNumber}`);
      setForm(initialForm);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Account could not be created.'));
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!lookupNumber.trim()) return;
    setLookupLoading(true);
    try {
      const response = await getAccount(lookupNumber.trim());
      onSelectAccount(response.data);
      setSuccess(`Connected to ${response.data.accountHolderName}'s account.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Account not found. Check the number and try again.'));
    } finally {
      setLookupLoading(false);
    }
  };

  const updateForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  return (
    <div className="page-stack">
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR BANKING, YOUR WAY</div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">Create a local demo account or connect to an existing one.</p>
        </div>
      </section>

      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {success && <div className="notice notice-success" role="status"><BadgeCheck size={18} /><span>{success}</span></div>}

      <div className="accounts-layout">
        <section className="card-surface account-form-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">GET STARTED</div><h2>Open a demo account</h2></div>
            <span className="section-icon icon-violet"><PlusCircle size={18} /></span>
          </div>
          <p className="panel-description">Create an account in your local banking database. Use sample information only.</p>
          <form onSubmit={handleCreate} className="form-grid">
            <div className="field-group field-span-2">
              <label className="field-label" htmlFor="accountHolderName">Full name</label>
              <input className="text-input" id="accountHolderName" name="accountHolderName" value={form.accountHolderName} onChange={updateForm} placeholder="e.g. Alex Morgan" autoComplete="name" required />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="email">Email address</label>
              <input className="text-input" id="email" name="email" type="email" value={form.email} onChange={updateForm} placeholder="alex@example.test" autoComplete="email" required />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="phone">Phone number</label>
              <input className="text-input" id="phone" name="phone" value={form.phone} onChange={updateForm} placeholder="+91 98765 43210" autoComplete="tel" required />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="accountType">Account type</label>
              <select className="text-input select-input" id="accountType" name="accountType" value={form.accountType} onChange={updateForm}>
                <option value="SAVING">Savings</option>
                <option value="CURRENT">Current</option>
                <option value="FIXED_DEPOSIT">Fixed deposit</option>
              </select>
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="initialDeposit">Opening deposit <span>(INR)</span></label>
              <div className="currency-input"><span>₹</span><input className="text-input" id="initialDeposit" name="initialDeposit" type="number" min="1" step="0.01" value={form.initialDeposit} onChange={updateForm} required /></div>
            </div>
            <button type="submit" className="button button-primary field-span-2" disabled={loading}>
              {loading ? <Loader2 className="spin" size={17} /> : <PlusCircle size={17} />}
              {loading ? 'Creating account…' : 'Create demo account'}
              {!loading && <ArrowRight size={16} className="button-end-icon" />}
            </button>
          </form>
          <div className="inline-safety"><ShieldCheck size={16} /><span>This is a demo environment. Please use fictional contact details.</span></div>
        </section>

        <div className="account-side-stack">
          <section className="card-surface current-account-card">
            <div className="panel-heading">
              <div><div className="eyebrow">CONNECTED ACCOUNT</div><h2>{account ? 'Account at a glance' : 'Nothing connected yet'}</h2></div>
              <span className={`account-type-icon ${account ? 'icon-green' : 'icon-blue'}`}><Landmark size={18} /></span>
            </div>
            {account ? (
              <>
                <div className="current-account-balance">{money(account.balance)}</div>
                <span className="metric-caption">AVAILABLE BALANCE</span>
                <div className="account-detail-line"><span>Account holder</span><strong>{account.accountHolderName}</strong></div>
                <div className="account-detail-line"><span>Account number</span><strong className="mono">{account.accountNumber}</strong></div>
                <div className="account-detail-line"><span>Type</span><strong>{account.accountType?.replace('_', ' ')}</strong></div>
                <div className="account-detail-line"><span>Status</span><span className="status-label completed">{account.status || 'ACTIVE'}</span></div>
                <button className="button button-quiet copy-button" type="button" onClick={() => navigator.clipboard?.writeText(account.accountNumber)}>
                  <Copy size={15} /> Copy account number
                </button>
              </>
            ) : (
              <div className="empty-account-note">Create a demo account or connect an existing account number to see its details here.</div>
            )}
          </section>

          <section className="card-surface lookup-panel">
            <div className="panel-heading">
              <div><div className="eyebrow">ALREADY A CUSTOMER?</div><h2>Connect an account</h2></div>
              <span className="section-icon icon-blue"><Search size={17} /></span>
            </div>
            <form onSubmit={handleLookup}>
              <label className="field-label" htmlFor="lookupAccount">Account number</label>
              <div className="input-with-action">
                <input className="text-input" id="lookupAccount" inputMode="numeric" autoComplete="off" value={lookupNumber} onChange={(event) => setLookupNumber(event.target.value)} placeholder="Enter account number" required />
                <button className="square-button" type="submit" disabled={lookupLoading}>
                  {lookupLoading ? <Loader2 className="spin" size={17} /> : <ArrowRight size={17} />}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
