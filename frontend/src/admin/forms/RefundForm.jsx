import React, { useState } from 'react';
import '../styles/RefundForm.css';

const RefundForm = ({ refund = {}, onSave }) => {
  const [paymentId, setPaymentId] = useState(refund.paymentId || '');
  const [reason, setReason] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    if (refund.action === 'request' && !paymentId.trim()) {
      setError('Payment ID is required');
      setIsSubmitting(false);
      return;
    }
    if (refund.action === 'request' && !reason.trim()) {
      setError('Reason is required');
      setIsSubmitting(false);
      return;
    }
    if (refund.action === 'reject' && !rejectionReason.trim()) {
      setError('Rejection reason is required');
      setIsSubmitting(false);
      return;
    }
    if (paymentId.length > 100) {
      setError('Payment ID must not exceed 100 characters');
      setIsSubmitting(false);
      return;
    }
    if (reason.length > 500) {
      setError('Reason must not exceed 500 characters');
      setIsSubmitting(false);
      return;
    }
    if (rejectionReason.length > 500) {
      setError('Rejection reason must not exceed 500 characters');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        paymentId: paymentId.trim(),
        action: refund.action,
      };
      if (refund.action === 'request') {
        payload.reason = reason.trim();
      } else if (refund.action === 'reject') {
        payload.rejectionReason = rejectionReason.trim();
      }
      await onSave(payload);
      setSuccess(`${refund.action.charAt(0).toUpperCase() + refund.action.slice(1)} action submitted successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const message = err.response?.data?.message || `Failed to submit ${refund.action} action`;
      const errors = err.response?.data?.errors?.map((e) => e.msg).join(', ') || '';
      setError(errors || message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-transaction-management-form">
      <h2>
        {refund.action === 'request'
          ? 'Request Refund'
          : refund.action === 'approve'
          ? 'Approve Refund'
          : 'Reject Refund'}
      </h2>
      <form onSubmit={handleSubmit}>
        {(refund.action === 'request' || refund.action === 'approve' || refund.action === 'reject') && (
          <div className="admin-transaction-management-form-group">
            <label htmlFor="payment-id">Payment ID</label>
            <input
              id="payment-id"
              type="text"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              placeholder="Enter Payment ID (e.g., pay_QWEig05cXGJvJu)"
              maxLength={100}
              disabled={isSubmitting || refund.action !== 'request'}
            />
          </div>
        )}
        {refund.action === 'request' && (
          <div className="admin-transaction-management-form-group">
            <label htmlFor="reason">Reason</label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you want a refund"
              maxLength={500}
              disabled={isSubmitting}
              rows="4"
            />
          </div>
        )}
        {refund.action === 'reject' && (
          <div className="admin-transaction-management-form-group">
            <label htmlFor="rejection-reason">Rejection Reason</label>
            <textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why the refund is rejected"
              maxLength={500}
              disabled={isSubmitting}
              rows="4"
            />
          </div>
        )}
        {error && <p className="admin-transaction-management-error">{error}</p>}
        {success && <p className="admin-transaction-management-success">{success}</p>}
        <div className="admin-transaction-management-form-actions">
          <button
            type="submit"
            className="admin-transaction-management-action-button save"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="transaction-spinner"></span> Submitting...
              </>
            ) : (
              refund.action === 'request'
                ? 'Submit Refund Request'
                : refund.action === 'approve'
                ? 'Approve Refund'
                : 'Reject Refund'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RefundForm;