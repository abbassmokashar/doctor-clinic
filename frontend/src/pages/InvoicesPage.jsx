import { useState, useEffect } from 'react';
import { invoiceAPI, patientAPI, appointmentAPI, installmentAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Receipt,
  Plus,
  Loader2,
  X,
  DollarSign,
  CheckCircle2,
  Filter,
  ChevronDown,
  ChevronUp,
  SplitSquareHorizontal,
  Calendar,
  CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';

const invoiceStatuses = ['PENDING', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'REFUNDED'];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [payingInstallment, setPayingInstallment] = useState(null);
  const { isAdmin, isReceptionist } = useAuth();
  const canEdit = isAdmin || isReceptionist;

  const [form, setForm] = useState({
    patientId: '',
    appointmentId: '',
    amount: '',
    description: '',
    dueDate: '',
    isInstallment: false,
    totalInstallments: '2',
    installmentMode: 'auto',
    manualInstallments: [{ amount: '', dueDate: '', notes: '' }],
  });

  const fetchData = () => {
    setLoading(true);
    const params = {};
    if (filter) params.status = filter;

    Promise.all([
      invoiceAPI.getAll(params),
      patientAPI.getAll({}),
    ])
      .then(([invRes, patRes]) => {
        setInvoices(invRes.data);
        setPatients(patRes.data);
      })
      .catch(() => toast.error('Failed to load invoices'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [filter]);

  const resetForm = () => {
    setForm({
      patientId: '',
      appointmentId: '',
      amount: '',
      description: '',
      dueDate: '',
      isInstallment: false,
      totalInstallments: '2',
      installmentMode: 'auto',
      manualInstallments: [{ amount: '', dueDate: '', notes: '' }],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let installments = [];

      if (form.isInstallment) {
        if (form.installmentMode === 'manual') {
          installments = form.manualInstallments
            .filter((inst) => inst.amount && inst.dueDate)
            .map((inst) => ({
              amount: parseFloat(inst.amount),
              dueDate: inst.dueDate,
              notes: inst.notes || `Installment`,
            }));

          if (installments.length === 0) {
            toast.error('Please add at least one installment');
            return;
          }
        }

        // For auto mode, we send totalInstallments and let the server split
      }

      await invoiceAPI.create({
        ...form,
        amount: parseFloat(form.amount),
        isInstallment: form.isInstallment,
        totalInstallments: form.isInstallment && form.installmentMode === 'auto'
          ? parseInt(form.totalInstallments)
          : undefined,
        installments: form.isInstallment && form.installmentMode === 'manual'
          ? installments
          : undefined,
      });

      toast.success(form.isInstallment ? 'Invoice with installment plan created' : 'Invoice created');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create invoice');
    }
  };

  const handleMarkPaid = async (id, amount) => {
    try {
      await invoiceAPI.markPaid(id, { amount });
      toast.success('Invoice marked as paid');
      fetchData();
    } catch (error) {
      toast.error('Failed to update invoice');
    }
  };

  const handleMarkInstallmentPaid = async (installment) => {
    try {
      await installmentAPI.markPaid(installment.id, {
        amount: installment.amount,
      });
      toast.success(`Installment #${installment.orderIndex} marked as paid`);
      fetchData();
    } catch (error) {
      toast.error('Failed to mark installment as paid');
    }
  };

  const addManualInstallment = () => {
    setForm({
      ...form,
      manualInstallments: [...form.manualInstallments, { amount: '', dueDate: '', notes: '' }],
    });
  };

  const removeManualInstallment = (idx) => {
    if (form.manualInstallments.length <= 1) return;
    setForm({
      ...form,
      manualInstallments: form.manualInstallments.filter((_, i) => i !== idx),
    });
  };

  const updateManualInstallment = (idx, field, value) => {
    const updated = [...form.manualInstallments];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, manualInstallments: updated });
  };

  const autoSplitInstallments = () => {
    if (!form.amount || !form.totalInstallments || !form.dueDate) return [];
    const amount = parseFloat(form.amount);
    const count = parseInt(form.totalInstallments);
    const splitAmount = Math.round((amount / count) * 100) / 100;
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(form.dueDate);
      date.setMonth(date.getMonth() + i);
      return {
        amount: i === count - 1
          ? Math.round((amount - splitAmount * (count - 1)) * 100) / 100
          : splitAmount,
        dueDate: date.toISOString().split('T')[0],
        notes: `Installment ${i + 1} of ${count}`,
      };
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: 'bg-amber-100 text-amber-700',
      PAID: 'bg-emerald-100 text-emerald-700',
      PARTIALLY_PAID: 'bg-blue-100 text-blue-700',
      CANCELLED: 'bg-red-100 text-red-700',
      REFUNDED: 'bg-purple-100 text-purple-700',
    };
    return styles[status] || styles.PENDING;
  };

  const getInstallmentStatusBadge = (status) => {
    const styles = {
      PENDING: 'bg-gray-100 text-gray-600',
      PAID: 'bg-emerald-100 text-emerald-700',
      OVERDUE: 'bg-red-100 text-red-700',
    };
    return styles[status] || styles.PENDING;
  };

  const totalPending = invoices
    .filter((inv) => inv.status === 'PENDING' || inv.status === 'PARTIALLY_PAID')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const totalPaid = invoices
    .filter((inv) => inv.status === 'PAID')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const autoPreview = form.isInstallment && form.installmentMode === 'auto' && form.amount && form.totalInstallments
    ? autoSplitInstallments()
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage billing, payments, and installment plans</p>
        </div>
        {canEdit && (
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Invoice
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">Total Invoices</p>
          <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Pending Amount</p>
          <p className="text-2xl font-bold text-amber-600">${totalPending.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Paid Amount</p>
          <p className="text-2xl font-bold text-emerald-600">${totalPaid.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">Installment Plans</p>
          <p className="text-2xl font-bold text-blue-600">
            {invoices.filter((inv) => inv.isInstallment).length}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="relative max-w-xs">
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <select className="input pl-10" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {invoiceStatuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No invoices found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500">
                  <th className="px-5 py-3 font-medium w-8"></th>
                  <th className="px-5 py-3 font-medium">#</th>
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Paid</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Due Date</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const isExpanded = expandedId === inv.id;
                  const paidCount = inv.installments?.filter((i) => i.status === 'PAID').length || 0;
                  const totalCount = inv.installments?.length || 0;

                  return (
                    <>
                      <tr
                        key={inv.id}
                        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                      >
                        <td className="px-5 py-3 text-gray-400">
                          {inv.isInstallment ? (
                            <SplitSquareHorizontal className="w-4 h-4 text-blue-400" />
                          ) : (
                            <DollarSign className="w-4 h-4" />
                          )}
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-900">#{inv.id}</td>
                        <td className="px-5 py-3 text-gray-700">
                          {inv.patient?.firstName} {inv.patient?.lastName}
                        </td>
                        <td className="px-5 py-3 text-gray-500 max-w-[180px] truncate">
                          {inv.description || '-'}
                        </td>
                        <td className="px-5 py-3 font-medium text-gray-900">${inv.amount.toFixed(2)}</td>
                        <td className="px-5 py-3 text-gray-600">
                          {inv.paidAmount > 0 ? `$${inv.paidAmount.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`badge ${getStatusBadge(inv.status)}`}>
                            {inv.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {inv.isInstallment ? (
                            <span className="text-xs text-blue-600 font-medium">
                              {paidCount}/{totalCount} paid
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">One-time</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-500">
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1">
                            {canEdit && !inv.isInstallment && inv.status === 'PENDING' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMarkPaid(inv.id, inv.amount); }}
                                className="btn-sm btn-primary"
                                title="Mark as paid"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Pay
                              </button>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Expanded Installment Detail Row */}
                      {isExpanded && inv.isInstallment && (
                        <tr key={`${inv.id}-installments`} className="bg-blue-50/30">
                          <td colSpan={10} className="px-5 py-4">
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                                <SplitSquareHorizontal className="w-4 h-4 text-blue-500" />
                                Installment Plan — {totalCount} payment{totalCount > 1 ? 's' : ''}
                              </h4>
                              <div className="grid gap-2">
                                {inv.installments?.map((inst) => (
                                  <div
                                    key={inst.id}
                                    className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-colors ${
                                      inst.status === 'PAID'
                                        ? 'bg-emerald-50 border-emerald-200'
                                        : 'bg-white border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                        inst.status === 'PAID'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-gray-100 text-gray-500'
                                      }`}>
                                        {inst.orderIndex}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">
                                          ${(inst.paidAmount || inst.amount).toFixed(2)}
                                        </p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                          <Calendar className="w-3 h-3" />
                                          Due {new Date(inst.dueDate).toLocaleDateString()}
                                          {inst.notes && <span className="ml-2">· {inst.notes}</span>}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className={`badge text-xs ${getInstallmentStatusBadge(inst.status)}`}>
                                        {inst.status === 'PAID' ? `Paid ${inst.paidAt ? new Date(inst.paidAt).toLocaleDateString() : ''}` : inst.status.replace('_', ' ')}
                                      </span>
                                      {canEdit && inst.status === 'PENDING' && (
                                        <button
                                          onClick={() => handleMarkInstallmentPaid(inst)}
                                          className="btn-sm btn-primary"
                                        >
                                          <CheckCircle2 className="w-3 h-3" /> Mark Paid
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Invoice</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Patient *</label>
                <select className="input" value={form.patientId} onChange={(e) => setForm({...form, patientId: e.target.value})} required>
                  <option value="">Select patient...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Amount ($) *</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="number" step="0.01" min="0" className="input pl-10" value={form.amount}
                    onChange={(e) => setForm({...form, amount: e.target.value})} required />
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Due Date</label>
                  <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({...form, dueDate: e.target.value})} />
                </div>
              </div>

              {/* Payment Type Toggle */}
              <div className="border-t border-gray-100 pt-4">
                <label className="label">Payment Type</label>
                <div className="flex gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setForm({...form, isInstallment: false})}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                      !form.isInstallment
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span className="font-medium text-sm">One-time Payment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({...form, isInstallment: true})}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                      form.isInstallment
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <SplitSquareHorizontal className="w-4 h-4" />
                    <span className="font-medium text-sm">Installment Plan</span>
                  </button>
                </div>
              </div>

              {/* Installment Options */}
              {form.isInstallment && (
                <div className="bg-blue-50/50 rounded-lg p-4 space-y-4 border border-blue-100">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({...form, installmentMode: 'auto'})}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        form.installmentMode === 'auto'
                          ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Auto-split
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({...form, installmentMode: 'manual'})}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        form.installmentMode === 'manual'
                          ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Manual
                    </button>
                  </div>

                  {form.installmentMode === 'auto' ? (
                    <div>
                      <label className="label">Number of Installments</label>
                      <div className="relative">
                        <SplitSquareHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                          className="input pl-10"
                          value={form.totalInstallments}
                          onChange={(e) => setForm({...form, totalInstallments: e.target.value})}
                        >
                          {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                            <option key={n} value={n}>{n} installments</option>
                          ))}
                        </select>
                      </div>

                      {/* Auto-split Preview */}
                      {autoPreview.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-xs font-medium text-gray-500">Payment Schedule Preview:</p>
                          {autoPreview.map((inst, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-white rounded px-3 py-2 border border-gray-100">
                              <span className="text-gray-500">#{idx + 1}</span>
                              <span className="font-medium text-gray-900">${inst.amount.toFixed(2)}</span>
                              <span className="text-gray-400">{new Date(inst.dueDate).toLocaleDateString()}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs font-medium text-gray-500 pt-1 border-t border-gray-100 mt-1">
                            <span>Total</span>
                            <span>${parseFloat(form.amount || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="label">Installments</label>
                      {form.manualInstallments.map((inst, idx) => (
                        <div key={idx} className="flex gap-2 items-start bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0 mt-1">
                            {idx + 1}
                          </div>
                          <div className="flex-1 grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs text-gray-500">Amount ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input text-sm mt-0.5"
                                placeholder="Amount"
                                value={inst.amount}
                                onChange={(e) => updateManualInstallment(idx, 'amount', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Due Date</label>
                              <input
                                type="date"
                                className="input text-sm mt-0.5"
                                value={inst.dueDate}
                                onChange={(e) => updateManualInstallment(idx, 'dueDate', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Notes</label>
                              <input
                                type="text"
                                className="input text-sm mt-0.5"
                                placeholder="Optional"
                                value={inst.notes}
                                onChange={(e) => updateManualInstallment(idx, 'notes', e.target.value)}
                              />
                            </div>
                          </div>
                          {form.manualInstallments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeManualInstallment(idx)}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded mt-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addManualInstallment}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add installment
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {form.isInstallment ? 'Create Installment Plan' : 'Create Invoice'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
