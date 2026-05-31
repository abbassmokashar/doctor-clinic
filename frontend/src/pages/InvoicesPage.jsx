import { useState, useEffect } from 'react';
import { invoiceAPI, patientAPI, appointmentAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Receipt,
  Plus,
  Loader2,
  X,
  DollarSign,
  CheckCircle2,
  Filter,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

const invoiceStatuses = ['PENDING', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'REFUNDED'];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ patientId: '', appointmentId: '', amount: '', description: '', dueDate: '' });
  const { isAdmin, isReceptionist } = useAuth();
  const canEdit = isAdmin || isReceptionist;

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await invoiceAPI.create({
        ...form,
        amount: parseFloat(form.amount),
      });
      toast.success('Invoice created');
      setShowModal(false);
      setForm({ patientId: '', appointmentId: '', amount: '', description: '', dueDate: '' });
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

  const totalPending = invoices
    .filter((inv) => inv.status === 'PENDING' || inv.status === 'PARTIALLY_PAID')
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage billing and payments</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Invoice
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <p className="text-2xl font-bold text-emerald-600">
            ${invoices.filter((inv) => inv.status === 'PAID').reduce((sum, inv) => sum + inv.amount, 0).toFixed(2)}
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
                  <th className="px-5 py-3 font-medium">#</th>
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Paid</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Due Date</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">#{inv.id}</td>
                    <td className="px-5 py-3 text-gray-700">
                      {inv.patient?.firstName} {inv.patient?.lastName}
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">
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
                    <td className="px-5 py-3 text-gray-500">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-5 py-3">
                      {canEdit && inv.status === 'PENDING' && (
                        <button
                          onClick={() => handleMarkPaid(inv.id, inv.amount)}
                          className="btn-sm btn-primary"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
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
              <div>
                <label className="label">Due Date</label>
                <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({...form, dueDate: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Create Invoice</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
