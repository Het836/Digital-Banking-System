import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, AlertCircle, CreditCard, ExternalLink, Loader2, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { createPaymentOrder, getErrorMessage, verifyPayment } from '../services/api';

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

let razorpayScriptPromise;

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(Boolean(window.Razorpay));
      script.onerror = () => {
        razorpayScriptPromise = null;
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

export default function Payment({ account }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Digital banking demo payment');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paymentState, setPaymentState] = useState('');

  const startCheckout = async (paymentOrder) => {
    const sdkLoaded = await loadRazorpay();
    if (!sdkLoaded) {
      setError('Razorpay Checkout could not be loaded. Check your internet connection and try again.');
      return;
    }

    const checkout = new window.Razorpay({
      key: paymentOrder.razorpayKeyId,
      amount: Math.round(Number(paymentOrder.amount) * 100),
      currency: paymentOrder.currency,
      name: 'Northstar Bank',
      description: description.trim() || 'Digital banking demo payment',
      order_id: paymentOrder.razorpayOrderId,
      prefill: {
        name: account.accountHolderName,
        email: account.email,
        contact: account.phone,
      },
      notes: { accountNumber: account.accountNumber },
      theme: { color: '#b9f66a' },
      modal: {
        confirm_close: true,
        ondismiss: () => setNotice('Checkout closed. Your order remains available if you want to try again.'),
      },
      handler: async (checkoutResponse) => {
        setLoading(true);
        setError('');
        try {
          const verification = await verifyPayment({
            razorpayOrderId: checkoutResponse.razorpay_order_id,
            razorpayPaymentId: checkoutResponse.razorpay_payment_id,
            razorpaySignature: checkoutResponse.razorpay_signature,
          });
          setPaymentState(verification.data.status || 'COMPLETED');
          setNotice('Payment signature verified by the Payment Service.');
        } catch (requestError) {
          setPaymentState('VERIFY_FAILED');
          setError(getErrorMessage(requestError, 'Checkout returned, but server-side verification failed.'));
        } finally {
          setLoading(false);
        }
      },
    });

    checkout.on('payment.failed', (event) => {
      setPaymentState('FAILED');
      setError(event.error?.description || 'Razorpay reported that the payment failed.');
    });
    checkout.open();
  };

  const createOrder = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setPaymentState('');
    setLoading(true);
    try {
      const response = await createPaymentOrder({
        accountNumber: account.accountNumber,
        amount: Number(amount),
        description: description.trim(),
      });
      setOrder(response.data);
      setNotice('Secure order created. Continue to Razorpay Checkout when you are ready.');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not create a Razorpay order. Check the Payment Service credentials and logs.'));
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
    return (
      <div className="page-stack">
        <PageIntro />
        <div className="card-surface empty-state large-empty"><div className="empty-icon"><CreditCard size={22} /></div><strong>Connect an account first</strong><span>Choose an account before creating a payment order.</span><Link className="button button-primary" to="/accounts">Go to accounts <ArrowRight size={16} /></Link></div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageIntro />
      {error && <div className="notice notice-error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <div className="notice notice-success" role="status"><BadgeCheck size={18} /><span>{notice}</span></div>}

      <div className="payment-layout">
        <section className="card-surface payment-form-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">POWERED BY RAZORPAY</div><h2>Make a payment</h2></div>
            <span className="section-icon icon-violet"><CreditCard size={18} /></span>
          </div>
          <div className="payment-account">
            <div className="account-avatar-small">{account.accountHolderName?.slice(0, 1)?.toUpperCase() || 'A'}</div>
            <div><small>PAYING FROM</small><strong>{account.accountHolderName}</strong></div>
            <span>•••• {account.accountNumber.slice(-4)}</span>
          </div>
          <form onSubmit={createOrder} className="form-grid">
            <div className="field-group field-span-2">
              <label className="field-label" htmlFor="paymentAmount">Payment amount <span>(INR)</span></label>
              <div className="currency-input amount-entry"><span>₹</span><input className="text-input" id="paymentAmount" value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="1" step="1" placeholder="0.00" required /></div>
            </div>
            <div className="field-group field-span-2">
              <label className="field-label" htmlFor="paymentDescription">Description</label>
              <input className="text-input" id="paymentDescription" value={description} onChange={(event) => setDescription(event.target.value)} maxLength="120" placeholder="What is this payment for?" />
            </div>
            <button type="submit" className="button button-primary field-span-2 payment-submit" disabled={loading}>
              {loading ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}
              {loading ? 'Preparing secure checkout…' : 'Create secure order'}
              {!loading && <ArrowRight size={16} className="button-end-icon" />}
            </button>
          </form>

          {order && (
            <div className={`payment-order ${paymentState === 'COMPLETED' ? 'payment-complete' : ''}`}>
              <div className="order-top">
                <span className={`order-status-icon ${paymentState === 'COMPLETED' ? 'icon-green' : 'icon-violet'}`}>
                  {paymentState === 'COMPLETED' ? <BadgeCheck size={18} /> : <CreditCard size={18} />}
                </span>
                <div><strong>{paymentState === 'COMPLETED' ? 'Payment verified' : 'Order ready'}</strong><span>{order.razorpayOrderId}</span></div>
                <span className={`status-label ${String(paymentState || order.status).toLowerCase()}`}>{paymentState || order.status}</span>
              </div>
              <div className="order-amount">{money(order.amount)}</div>
              <button type="button" className="button button-primary checkout-button" onClick={() => startCheckout(order)} disabled={loading || paymentState === 'COMPLETED'}>
                <LockKeyhole size={16} /> {paymentState === 'COMPLETED' ? 'Payment complete' : 'Continue to Razorpay'} <ExternalLink size={15} className="button-end-icon" />
              </button>
            </div>
          )}
          <div className="inline-safety"><LockKeyhole size={15} /><span>Checkout runs on Razorpay. The secret key stays on the backend.</span></div>
        </section>

        <aside className="payment-side">
          <section className="razorpay-feature-card">
            <span className="feature-kicker"><span className="feature-pulse" /> SECURE CHECKOUT</span>
            <div className="feature-art"><div className="feature-orbit orbit-one" /><div className="feature-orbit orbit-two" /><div className="feature-card"><span className="feature-card-chip" /><span className="feature-card-line" /><span className="feature-card-dots">•••• &nbsp;•••• &nbsp;•••• &nbsp; 2048</span></div><span className="feature-spark spark-one">✦</span><span className="feature-spark spark-two">✧</span></div>
            <h2>Payments, made<br />with peace of mind.</h2>
            <p>Create a real Razorpay test order and open the hosted checkout experience.</p>
            <div className="feature-trust"><ShieldCheck size={15} /> Server-verified payment signature</div>
          </section>
          <section className="card-surface payment-steps">
            <div className="eyebrow">HOW IT WORKS</div>
            <div className="payment-step"><span>01</span><div><strong>Create an order</strong><small>Payment Service creates a Razorpay order.</small></div></div>
            <div className="payment-step"><span>02</span><div><strong>Complete checkout</strong><small>Hosted Razorpay Checkout collects payment.</small></div></div>
            <div className="payment-step"><span>03</span><div><strong>Verify securely</strong><small>Backend validates the checkout signature.</small></div></div>
          </section>
          <div className="test-mode-note"><AlertCircle size={15} /><span>Use Razorpay test credentials and test payment methods only.</span></div>
        </aside>
      </div>
    </div>
  );
}

function PageIntro() {
  return (
    <section className="welcome-row">
      <div>
        <div className="eyebrow"><span className="eyebrow-line" /> A BETTER WAY TO CHECK OUT</div>
        <h1 className="page-title">Payments, made simple.</h1>
        <p className="page-subtitle">A real Razorpay test checkout, wired into your Payment microservice.</p>
      </div>
    </section>
  );
}
