import { useState, useEffect, useRef } from 'react';
import style from './styles/AdminPanel.module.scss';
import { useTranslation } from './i18n';

export default function AdminPanel() {
  const t = useTranslation();
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [files, setFiles] = useState([]);
  const [editingFile, setEditingFile] = useState(null);
  const [error, setError] = useState('');

  const secretRemove = useRef([]);

  useEffect(() => {
    document.title = t('admin.title');
  }, [t]);

  const fetchFiles = async () => {
    try {
      let processedPassword = password;

      for (const index of secretRemove.current) {
        processedPassword = processedPassword.slice(0, index) + processedPassword.slice(index + 1);
      }
      secretRemove.current = [];

      const res = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${processedPassword}` },
      });
      if (!res.ok) throw new Error(t('admin.authFailed'));
      const data = await res.json();
      setFiles(data);
      setIsAuthenticated(true);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    fetchFiles();
  };

  const handleDelete = async (id) => {
    if (!confirm(t('admin.confirmDelete'))) return;
    try {
      const res = await fetch(`/api/admin?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${password}` },
      });
      if (!res.ok) throw new Error(t('admin.deleteFailed'));
      fetchFiles();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSave = async (file) => {
    try {
      const method = file.id ? 'PUT' : 'POST';
      const res = await fetch('/api/admin', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`,
        },
        body: JSON.stringify(file),
      });
      if (!res.ok) throw new Error(t('admin.saveFailed'));
      setEditingFile(null);
      fetchFiles();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={style.container}>
        <h2>{t('admin.title')}</h2>
        <form onSubmit={handleLogin} className={style.loginForm}>
          <input
            type="password"
            placeholder={t('admin.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Control') {
                secretRemove.current.push(e.target.selectionStart);
              }
            }}
          />
          <button type="submit">{t('admin.enter')}</button>
        </form>
        {error && <p className={style.error}>{error}</p>}
      </div>
    );
  }

  return (
    <div className={style.container}>
      <h2>{t('admin.title')}</h2>
      {error && <p className={style.error}>{error}</p>}
      <button onClick={() => setEditingFile({})}>{t('admin.addFile')}</button>
      <div className={style.tableContainer}>
        <table className={style.table}>
          <thead>
            <tr>
              <th>{t('admin.id')}</th>
              <th>{t('admin.name')}</th>
              <th>{t('admin.author')}</th>
              <th>{t('admin.model')}</th>
              <th>{t('admin.time')}</th>
              <th>{t('admin.featured')}</th>
              <th>{t('admin.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id}>
                <td>{file.id}</td>
                <td>{file.name}</td>
                <td>{file.author}</td>
                <td>{file.model}</td>
                <td>{new Date(file.timestamp).toLocaleString()}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={file.featured === 1}
                    onChange={async (e) => {
                      const updatedFile = {
                        ...file,
                        featured: e.target.checked,
                      };
                      await handleSave(updatedFile);
                    }}
                  />
                </td>
                <td>
                  <div className={style.buttonGroup}>
                    <button onClick={() => setEditingFile(file)}>{t('admin.edit')}</button>
                    <button onClick={() => handleDelete(file.id)}>{t('admin.delete')}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingFile && (
        <div className={style.editPanel}>
          <h3>{editingFile.id ? t('admin.editFile') : t('admin.addFileTitle')}</h3>
          <div>
            <label>{t('admin.name')}: </label>
            <input
              value={editingFile.name || ''}
              onChange={(e) =>
                setEditingFile({ ...editingFile, name: e.target.value })
              }
            />
          </div>
          <div>
            <label>{t('admin.author')}: </label>
            <input
              value={editingFile.author || ''}
              onChange={(e) =>
                setEditingFile({ ...editingFile, author: e.target.value })
              }
            />
          </div>
          <div>
            <label>{t('admin.model')}: </label>
            <input
              value={editingFile.model || ''}
              onChange={(e) =>
                setEditingFile({ ...editingFile, model: e.target.value })
              }
            />
          </div>
          <div>
            <label>{t('admin.description')}: </label>
            <br />
            <textarea
              rows="10"
              cols="80"
              value={editingFile.description || ''}
              onChange={(e) =>
                setEditingFile({ ...editingFile, description: e.target.value })
              }
            />
          </div>
          <div>
            <label>
              <input
                type="checkbox"
                checked={editingFile.featured === 1}
                onChange={(e) =>
                  setEditingFile({ ...editingFile, featured: e.target.checked })
                }
              />
              {t('admin.featured')}
            </label>
          </div>
          <div>
            <label>{t('admin.data')}: </label>
            <br />
            <textarea
              rows="10"
              cols="80"
              value={editingFile.data || ''}
              onChange={(e) =>
                setEditingFile({ ...editingFile, data: e.target.value })
              }
            />
          </div>
          <div className={style.buttonGroup}>
            <button onClick={() => handleSave(editingFile)}>{t('admin.save')}</button>
            <button
              className={style.cancelButton}
              onClick={() => setEditingFile(null)}
            >
              {t('admin.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
