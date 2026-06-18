import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { settingsAPI, backupAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Settings,
  Palette,
  Users,
  Database,
  Save,
  Loader2,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  Shield,
  UserCog,
  Search,
  Check,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'backup', label: 'Backup', icon: Database },
];

const ROLES = ['ADMIN', 'DOCTOR', 'RECEPTIONIST'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>You don't have permission to access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-body)' }}>Settings</h1>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Manage clinic settings and configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent hover:border-gray-300'
            }`}
            style={{
              color: activeTab === tab.id ? 'var(--primary-700)' : 'var(--text-muted)',
              borderBottomColor: activeTab === tab.id ? 'var(--primary-600)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = 'var(--text-label)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'general' && <GeneralTab />}
        {activeTab === 'appearance' && <AppearanceTab />}
        {activeTab === 'accounts' && <AccountsTab />}
        {activeTab === 'backup' && <BackupTab />}
      </div>
    </div>
  );
}

function GeneralTab() {
  const { appName, setAppName } = useTheme();
  const [name, setName] = useState(appName);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(appName); }, [appName]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('App name cannot be empty');
      return;
    }
    setSaving(true);
    await setAppName(name.trim());
    setSaving(false);
    toast.success('App name updated');
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-body)' }}>Clinic Name</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          This name will appear throughout the system — in the sidebar, login page, and page titles.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            className="input flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Doctor Clinic"
          />
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Current name: <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{appName}</span>
        </p>
      </div>
    </div>
  );
}

function AppearanceTab() {
  const { theme, toggleTheme, isDark } = useTheme();
  const [saving, setSaving] = useState(false);

  const handleToggle = async () => {
    setSaving(true);
    toggleTheme();
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      toast.success(isDark ? 'Light mode activated' : 'Dark mode activated');
    } catch {}
    setSaving(false);
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-body)' }}>Theme</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Choose between light and dark mode for the entire system. Changes apply immediately.
        </p>

        <div className="flex items-center justify-between p-4 rounded-xl border" style={{
          backgroundColor: 'var(--surface-alt)',
          borderColor: 'var(--border)',
        }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg" style={{
              backgroundColor: 'var(--surface)',
              color: 'var(--text-body)',
              border: '1px solid var(--border)',
            }}>
              {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-medium" style={{ color: 'var(--text-body)' }}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {isDark
                  ? 'Dark backgrounds with light text — easier on the eyes in low light.'
                  : 'Light backgrounds with dark text — clean and classic.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={saving}
            className="toggle shrink-0"
            data-checked={isDark ? 'true' : 'false'}
            role="switch"
            aria-checked={isDark}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        {/* Preview */}
        <div className="mt-6">
          <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Preview</p>
          <div className="rounded-xl border overflow-hidden" style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--body-bg)',
          }}>
            {/* Fake sidebar */}
            <div className="flex">
              <div className="w-32 p-3 space-y-2" style={{
                backgroundColor: 'var(--surface)',
                borderRight: '1px solid var(--border)',
              }}>
                <div className="h-3 rounded w-20" style={{ backgroundColor: 'var(--primary-600)' }} />
                <div className="h-2 rounded w-16" style={{ backgroundColor: 'var(--primary-200)' }} />
                <div className="h-2 rounded w-14 mt-3" style={{ backgroundColor: 'var(--gray-200)' }} />
                <div className="h-2 rounded w-16" style={{ backgroundColor: 'var(--gray-200)' }} />
                <div className="h-2 rounded w-12" style={{ backgroundColor: 'var(--gray-200)' }} />
              </div>
              {/* Fake content */}
              <div className="flex-1 p-3 space-y-2">
                <div className="flex gap-2">
                  <div className="h-4 rounded flex-1" style={{ backgroundColor: 'var(--gray-200)' }} />
                  <div className="h-8 w-16 rounded" style={{ backgroundColor: 'var(--primary-600)' }} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-16 rounded" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} />
                  <div className="h-16 rounded" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} />
                  <div className="h-16 rounded" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} />
                </div>
                <div className="h-20 rounded" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountsTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', password: '' });
  const [search, setSearch] = useState('');

  const fetchUsers = () => {
    setLoading(true);
    settingsAPI.getUsers()
      .then((res) => setUsers(res.data))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleActive = async (user) => {
    try {
      await settingsAPI.updateUser(user.id, { isActive: !user.isActive });
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user.id);
    setEditForm({ name: user.name, email: user.email, role: user.role, password: '' });
  };

  const handleSaveEdit = async () => {
    try {
      const data = { name: editForm.name, email: editForm.email, role: editForm.role };
      if (editForm.password) data.password = editForm.password;
      await settingsAPI.updateUser(editingUser, data);
      toast.success('User updated');
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user');
    }
  };

  const filtered = users.filter((u) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage user accounts, roles, and access.</p>
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search users..."
            className="input pl-10 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary-600)' }} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--gray-50)' }}>
                  <th className="px-5 py-3 font-medium text-left" style={{ color: 'var(--text-muted)' }}>Name</th>
                  <th className="px-5 py-3 font-medium text-left" style={{ color: 'var(--text-muted)' }}>Email</th>
                  <th className="px-5 py-3 font-medium text-left" style={{ color: 'var(--text-muted)' }}>Role</th>
                  <th className="px-5 py-3 font-medium text-left" style={{ color: 'var(--text-muted)' }}>Status</th>
                  <th className="px-5 py-3 font-medium text-left" style={{ color: 'var(--text-muted)' }}>Created</th>
                  <th className="px-5 py-3 font-medium text-left" style={{ color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="border-t" style={{ borderColor: 'var(--border-light)' }}>
                    {editingUser === user.id ? (
                      <>
                        <td className="px-5 py-2">
                          <input className="input text-sm py-1" value={editForm.name}
                            onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
                        </td>
                        <td className="px-5 py-2">
                          <input className="input text-sm py-1" value={editForm.email}
                            onChange={(e) => setEditForm({...editForm, email: e.target.value})} />
                        </td>
                        <td className="px-5 py-2">
                          <select className="input text-sm py-1" value={editForm.role}
                            onChange={(e) => setEditForm({...editForm, role: e.target.value})}>
                            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td className="px-5 py-2">
                          <input className="input text-sm py-1" type="password" value={editForm.password}
                            onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                            placeholder="New password" />
                        </td>
                        <td className="px-5 py-2" style={{ color: 'var(--text-muted)' }}>-</td>
                        <td className="px-5 py-2">
                          <div className="flex gap-1">
                            <button onClick={handleSaveEdit} className="btn-sm btn-primary">
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => setEditingUser(null)} className="btn-sm btn-secondary">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-body)' }}>{user.name}</td>
                        <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>{user.email}</td>
                        <td className="px-5 py-3">
                          <span className={`badge ${
                            user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                            user.role === 'DOCTOR' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>{user.role}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1" style={{
                            color: user.isActive ? 'var(--primary-600)' : 'var(--text-muted)',
                          }}>
                            {user.isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => handleEdit(user)} className="btn-sm btn-secondary">
                              <UserCog className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => handleToggleActive(user)}
                              className={`btn-sm ${user.isActive ? 'btn-danger' : 'btn-primary'}`}
                            >
                              {user.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function BackupTab() {
  const [dbInfo, setDbInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchDbInfo = () => {
    backupAPI.getInfo()
      .then((res) => setDbInfo(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDbInfo(); }, []);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await backupAPI.download();
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `clinic-backup-${dateStr}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Backup downloaded successfully');
    } catch (error) {
      toast.error('Failed to download backup');
    } finally {
      setDownloading(false);
    }
  };

  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm('Are you sure you want to restore this backup? This will replace all current data. A backup of the current database will be saved automatically.')) {
      e.target.value = '';
      return;
    }

    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await backupAPI.restore(formData);
      toast.success(res.data.message || 'Database restored successfully');
      fetchDbInfo();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to restore database');
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-body)' }}>Database Backup</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Download a backup of your entire database or restore from a previous backup.
        </p>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--primary-600)' }} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* DB Info */}
            {dbInfo?.exists && (
              <div className="rounded-lg p-3 text-sm" style={{
                backgroundColor: 'var(--gray-50)',
                color: 'var(--text-secondary)',
              }}>
                <p>Size: <span className="font-medium" style={{ color: 'var(--text-body)' }}>{dbInfo.sizeFormatted}</span></p>
                <p>Last modified: <span className="font-medium" style={{ color: 'var(--text-body)' }}>{new Date(dbInfo.lastModified).toLocaleString()}</span></p>
              </div>
            )}

            {/* Download */}
            <button onClick={handleDownload} disabled={downloading} className="btn-primary w-full">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? 'Downloading...' : 'Download Backup'}
            </button>

            {/* Restore */}
            <div className="pt-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-label)' }}>Restore from Backup</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Upload a previously downloaded `.db` file. The current database will be backed up automatically before restoring.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={restoring}
                className="btn-secondary w-full"
              >
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {restoring ? 'Restoring...' : 'Upload Backup File'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".db,.sqlite"
                className="hidden"
                onChange={handleRestore}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
