/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getAccessToken } from './googleAuth';
import { 
  HardDrive, 
  FileSpreadsheet,
  LogOut, 
  Key, 
  Mail, 
  Search, 
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Folder,
  X,
  Plus,
  ExternalLink,
  Copy,
  Check,
  UserMinus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GoogleFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
}

export default function App() {
  const [serviceAccount, setServiceAccount] = useState<any>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState<GoogleFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'remove-access';
    title: string;
    inputValue: string;
    fileId?: string;
  }>({
    isOpen: false,
    type: 'remove-access',
    title: '',
    inputValue: '',
  });

  useEffect(() => {
    const savedAccount = localStorage.getItem('gcp_service_account');
    const savedEmail = localStorage.getItem('gcp_email');
    if (savedAccount && savedEmail) {
      try {
        setServiceAccount(JSON.parse(savedAccount));
        setEmail(savedEmail);
        setIsSetup(true);
      } catch (e) {
        localStorage.removeItem('gcp_service_account');
      }
    }
  }, []);

  useEffect(() => {
    if (isSetup && serviceAccount) {
      fetchFiles();
    }
  }, [isSetup]);

  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(jsonInput);
      if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
        throw new Error('Invalid Service Account JSON. Must include project_id, private_key, and client_email.');
      }
      setServiceAccount(parsed);
      setEmail(parsed.client_email);
      localStorage.setItem('gcp_service_account', jsonInput);
      localStorage.setItem('gcp_email', parsed.client_email);
      setIsSetup(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Invalid JSON format');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gcp_service_account');
    localStorage.removeItem('gcp_email');
    setServiceAccount(null);
    setIsSetup(false);
    setFiles([]);
  };

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken(serviceAccount);
      const params = new URLSearchParams({
        pageSize: '100',
        fields: 'nextPageToken,files(id,name,mimeType,size,createdTime)',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      });
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (!response.ok) {
        const msg = data?.error?.message || `Drive API error (${response.status})`;
        throw new Error(msg);
      }
      setFiles(data.files ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeAccess = async (fileId: string) => {
    setLoading(true);
    try {
      const token = await getAccessToken(serviceAccount);
      const clientEmail = serviceAccount.client_email;

      // 1. List permissions to find our permission ID
      const permsRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=permissions(id,emailAddress)&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const permsData = await permsRes.json();
      if (!permsRes.ok) {
        throw new Error(permsData?.error?.message || `Could not list permissions (${permsRes.status})`);
      }

      const myPerm = (permsData.permissions ?? []).find(
        (p: any) => p.emailAddress === clientEmail,
      );

      if (!myPerm?.id) {
        throw new Error('Could not find service account permission on this file. It might already be removed or inherited.');
      }

      // 2. Delete the permission
      const delRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${myPerm.id}?supportsAllDrives=true`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      );

      if (!delRes.ok && delRes.status !== 204) {
        const errData = await delRes.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Failed to remove permission (${delRes.status})`);
      }

      setSuccess('Access removed successfully');
      fetchFiles();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const openRemoveAccessModal = (fileId: string, fileName: string) => {
    setModal({
      isOpen: true,
      type: 'remove-access',
      title: 'Remove My Access',
      inputValue: fileName,
      fileId,
    });
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modal.type === 'remove-access') {
      if (modal.fileId) removeAccess(modal.fileId);
    }
  };

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderError = (err: string) => {
    const isApiDisabled = err.includes('has not been used in project') || err.includes('is disabled');
    const isQuotaError = err.toLowerCase().includes('quota');
    const isPermissionError = err.toLowerCase().includes('insufficient permissions');
    const urlMatch = err.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : null;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className={`mt-0.5 shrink-0 ${isQuotaError ? 'text-amber-500' : isPermissionError ? 'text-orange-500' : 'text-red-500'}`} />
          <div className="flex-1">
            <p className={`font-semibold ${isQuotaError ? 'text-amber-700' : isPermissionError ? 'text-orange-700' : 'text-red-700'}`}>
              {isQuotaError ? 'Storage Quota Exceeded' : isPermissionError ? 'Permission Denied' : 'Google API Error'}
            </p>
            <p className={`text-sm mt-1 ${isQuotaError ? 'text-amber-600' : isPermissionError ? 'text-orange-600' : 'text-red-600'}`}>
              {err.replace(url || '', '')}
            </p>
          </div>
        </div>

        {isPermissionError && (
          <div className="bg-white/50 rounded-xl p-4 border border-orange-200 mt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-orange-800 mb-2">Required Action: Check Sharing Settings</h4>
            <div className="text-xs text-orange-700 space-y-2">
              <p>• Ensure the Service Account email has been granted <strong>Editor</strong> access to this file.</p>
              <p>• If the file is in a Shared Drive, check if the Service Account has the <strong>Content Manager</strong> or <strong>Contributor</strong> role.</p>
              <p>• You can find the Service Account email in the "Active Account" section of the sidebar.</p>
            </div>
          </div>
        )}

        {isQuotaError && (
          <div className="bg-white/50 rounded-xl p-4 border border-amber-200 mt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2">Required Action: Free Up Space</h4>
            <div className="text-xs text-amber-700 space-y-2">
              <p>• Service Accounts have limited storage (often 0-15GB).</p>
              <p>• Try deleting unused files from the account associated with this Service Account.</p>
              <p>• Empty the trash in Google Drive to permanently free up space.</p>
            </div>
          </div>
        )}

        {isApiDisabled && (
          <div className="bg-white/50 rounded-xl p-4 border border-red-200 mt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-red-800 mb-2">Required Action: Enable API</h4>
            <p className="text-xs text-red-700 mb-4">
              Your Google Cloud Project needs the Drive and Sheets APIs enabled before this app can access your files.
            </p>
            <div className="flex flex-wrap gap-2">
              {url && (
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-all flex items-center gap-2"
                >
                  Enable Drive API <ExternalLink size={12} />
                </a>
              )}
              <a 
                href="https://console.cloud.google.com/apis/library/sheets.googleapis.com" 
                target="_blank" 
                rel="noreferrer" 
                className="px-4 py-2 bg-white border border-red-200 text-red-700 text-xs font-bold rounded-lg hover:bg-red-50 transition-all flex items-center gap-2"
              >
                Enable Sheets API <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}
      </div>
    );
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isSetup) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-gray-100"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <Key className="text-blue-600 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">GCP Manager Setup</h1>
            <p className="text-gray-500 text-sm text-center mt-2">
              Paste your Service Account JSON to access your GCP Drive & Sheets.
            </p>
          </div>

          <form onSubmit={handleSetup} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
                <FileText size={14} /> Service Account JSON
              </label>
              <textarea 
                required
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{ "type": "service_account", ... }'
                rows={10}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-mono text-xs"
              />
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-50 border border-red-100 rounded-2xl"
              >
                {renderError(error)}
              </motion.div>
            )}

            <button 
              type="submit"
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-[0.98]"
            >
              Connect to GCP
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-gray-900 font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-bottom border-gray-100">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
            <HardDrive className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-lg tracking-tight">GCP Manager</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl font-medium transition-all">
            <HardDrive size={20} /> Drive Files
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-2xl p-4 mb-4">
            <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">Active Account</p>
            <p className="text-xs font-medium text-gray-700 truncate">{email}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-all"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={fetchFiles}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-50 font-medium"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <RefreshCw size={18} />
              )}
              <span>Refresh</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Files & Drives</h2>
                <p className="text-gray-500 mt-1">Manage your Google Drive assets and spreadsheets.</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-5 bg-red-50 border border-red-100 rounded-3xl"
                >
                  {renderError(error)}
                </motion.div>
              )}

              {success && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-green-50 border border-green-100 text-green-700 rounded-2xl flex items-center gap-3"
                >
                  <CheckCircle2 size={20} />
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="grid grid-cols-[1fr_2fr_1fr_100px] gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <div>Name</div>
                <div>Google ID</div>
                <div>Created At</div>
                <div className="text-right">Actions</div>
              </div>

              <div className="divide-y divide-gray-100">
                {loading && files.length === 0 ? (
                  <div className="p-20 flex flex-col items-center justify-center text-gray-400">
                    <Loader2 className="animate-spin mb-4" size={32} />
                    <p>Fetching your files...</p>
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="p-20 flex flex-col items-center justify-center text-gray-400">
                    <Search className="mb-4 opacity-20" size={48} />
                    <p>No files found matching your search.</p>
                  </div>
                ) : (
                  filteredFiles.map((file) => (
                    <motion.div 
                      key={file.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid grid-cols-[1fr_2fr_1fr_100px] gap-4 px-6 py-5 hover:bg-gray-50 transition-all group items-center"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        {file.mimeType.includes('spreadsheet') ? (
                          <FileSpreadsheet className="text-green-600 shrink-0" size={20} />
                        ) : file.mimeType.includes('folder') ? (
                          <Folder className="text-blue-500 shrink-0" size={20} />
                        ) : (
                          <FileText className="text-gray-400 shrink-0" size={20} />
                        )}
                        <span className="font-semibold truncate text-sm">{file.name}</span>
                      </div>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="font-mono text-[11px] text-gray-400 bg-gray-50 px-2 py-1 rounded-md truncate flex-1">
                          {file.id}
                        </div>
                        <button
                          onClick={() => handleCopy(file.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all shrink-0"
                          title="Copy ID"
                        >
                          {copiedId === file.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(file.createdTime).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <a 
                          href={`https://drive.google.com/open?id=${file.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Open in Drive"
                        >
                          <ExternalLink size={16} />
                        </a>
                        <button 
                          onClick={() => openRemoveAccessModal(file.id, file.name)}
                          className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                          title="Remove My Access"
                        >
                          <UserMinus size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Custom Modal */}
      <AnimatePresence>
        {modal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">{modal.title}</h3>
                <button 
                  onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleModalSubmit} className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl flex items-start gap-3 bg-orange-50">
                    <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-orange-700">
                      Are you sure you want to <span className="font-bold">remove your access</span> from <span className="font-bold">"{modal.inputValue}"</span>? You will no longer be able to see or manage this file.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading && <Loader2 className="animate-spin" size={18} />}
                    Remove Access
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
