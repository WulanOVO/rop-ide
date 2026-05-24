import { useState, useEffect } from 'react';
import style from './styles/AdminPanel.module.scss';

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [files, setFiles] = useState([]);
  const [editingFile, setEditingFile] = useState(null);
  const [error, setError] = useState('');

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${password}` },
      });
      if (!res.ok) throw new Error('认证失败');
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
    if (!confirm('确定删除？')) return;
    try {
      const res = await fetch(`/api/admin?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${password}` },
      });
      if (!res.ok) throw new Error('删除失败');
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
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify(file),
      });
      if (!res.ok) throw new Error('保存失败');
      setEditingFile(null);
      fetchFiles();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={style.container}>
        <h2>管理面板</h2>
        <form onSubmit={handleLogin} className={style.loginForm}>
          <input
            type="password"
            placeholder="管理员密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit">进入</button>
        </form>
        {error && <p className={style.error}>{error}</p>}
      </div>
    );
  }

  return (
    <div className={style.container}>
      <h2>管理面板</h2>
      {error && <p className={style.error}>{error}</p>}
      <button onClick={() => setEditingFile({})}>添加文件</button>
      <div className={style.tableContainer}>
        <table className={style.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>名称</th>
              <th>作者</th>
              <th>型号</th>
              <th>时间</th>
              <th>精选</th>
              <th>操作</th>
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
                      const updatedFile = { ...file, featured: e.target.checked };
                      await handleSave(updatedFile);
                    }}
                  />
                </td>
                <td>
                  <div className={style.buttonGroup}>
                    <button onClick={() => setEditingFile(file)}>编辑</button>
                    <button onClick={() => handleDelete(file.id)}>删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingFile && (
        <div className={style.editPanel}>
          <h3>{editingFile.id ? '编辑文件' : '添加文件'}</h3>
          <div>
            <label>名称: </label>
            <input
              value={editingFile.name || ''}
              onChange={(e) =>
                setEditingFile({ ...editingFile, name: e.target.value })
              }
            />
          </div>
          <div>
            <label>作者: </label>
            <input
              value={editingFile.author || ''}
              onChange={(e) =>
                setEditingFile({ ...editingFile, author: e.target.value })
              }
            />
          </div>
          <div>
            <label>型号: </label>
            <input
              value={editingFile.model || ''}
              onChange={(e) =>
                setEditingFile({ ...editingFile, model: e.target.value })
              }
            />
          </div>
          <div>
            <label>描述: </label>
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
              精选
            </label>
          </div>
          <div>
            <label>数据: </label>
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
            <button onClick={() => handleSave(editingFile)}>保存</button>
            <button onClick={() => setEditingFile(null)}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
