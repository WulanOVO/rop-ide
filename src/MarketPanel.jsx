import { useEffect, useMemo, useState } from 'react';
import Svg from './svg';
import style from './styles/MarketPanel.module.scss';

const modelOptions = ['fx-991CNX (VerC)', 'fx-991CNX (VerF)'];

const normalizeName = (name) => {
  if (!name) return '未命名';
  return name.replace(/\.rop$/i, '');
};

export default function MarketPanel({
  show,
  withPublishBtn,
  onClose,
  currentFileData,
  currentFileName,
  onLoadFile,
  addMessage,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishName, setPublishName] = useState('');
  const [publishAuthor, setPublishAuthor] = useState('');
  const [publishModel, setPublishModel] = useState('');
  const [publishOtherModel, setPublishOtherModel] = useState('');
  const [publishDescription, setPublishDescription] = useState('');

  const loadMarketList = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/market');
      if (!res.ok) {
        throw new Error('获取列表失败');
      }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      addMessage(e.message || '获取列表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      loadMarketList();
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;
    setPublishName(normalizeName(currentFileName));
    setPublishDescription('');
    setShowPublishModal(false);
  }, [show, currentFileName]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        String(item.name || '')
          .toLowerCase()
          .includes(term) ||
        String(item.author || '')
          .toLowerCase()
          .includes(term) ||
        String(item.model || '')
          .toLowerCase()
          .includes(term) ||
        String(item.description || '')
          .toLowerCase()
          .includes(term),
    );
  }, [items, searchTerm]);

  const handlePublish = async () => {
    const name = publishName.trim();
    const model =
      publishModel.trim() === 'other'
        ? publishOtherModel.trim()
        : publishModel.trim();

    if (!name) {
      addMessage('请输入文件名称', 'error');
      return;
    }
    if (!publishAuthor.trim()) {
      addMessage('请输入作者名称', 'error');
      return;
    }
    if (!model) {
      addMessage('请选择机型', 'error');
      return;
    }
    if (!publishDescription.trim()) {
      addMessage('请输入文件描述', 'error');
      return;
    }
    if (!currentFileData) {
      addMessage('当前文件数据为空', 'error');
      return;
    }
    setPublishing(true);

    try {
      const payload = {
        name,
        author: publishAuthor.trim(),
        model,
        description: publishDescription.trim(),
        data: JSON.stringify(currentFileData),
        timestamp: Date.now(),
      };
      const res = await fetch('/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error('发布失败');
      }
      addMessage('发布成功', 'info');
      await loadMarketList();
    } catch (e) {
      addMessage(e.message || '发布失败', 'error');
    } finally {
      setPublishing(false);
      setShowPublishModal(false);
    }
  };

  const handleDownload = async (item) => {
    if (!item?.id) return;
    setDownloadingId(item.id);
    try {
      const res = await fetch(`/api/market?id=${item.id}`);
      if (!res.ok) {
        throw new Error('下载失败');
      }
      const data = await res.json();
      if (!data?.data) {
        throw new Error('文件内容为空');
      }
      const fileData = JSON.parse(data.data);
      onLoadFile(fileData, item.name);
    } catch (e) {
      addMessage(e.message || '下载失败', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!show) return null;

  return (
    <div className={style.overlay} onClick={onClose}>
      <div className={style.marketPanel} onClick={(e) => e.stopPropagation()}>
        <div className={style.header}>
          <h2>程序广场</h2>
          <div className={style.panelActions}>
            <div className={style.searchContainer}>
              <input
                type="text"
                placeholder="搜索 文件/作者/机型/描述..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={style.searchInput}
              />
            </div>
            {withPublishBtn && (
              <button
                onClick={() => setShowPublishModal(true)}
                className={style.primaryButton}
              >
                <Svg size={16} icon="add" />
                发布
              </button>
            )}
            <button onClick={onClose} className={style.closeButton}>
              <Svg size={16} icon="close" />
              关闭
            </button>
          </div>
        </div>

        <div className={style.marketList}>
          {filteredItems.length === 0 && (
            <div className={style.emptyState}>
              {loading ? '加载中...' : '暂无在线文件'}
            </div>
          )}
          {filteredItems.map((item) => (
            <div key={item.id} className={style.marketCard}>
              <div className={style.cardHeader}>
                <div className={style.cardInfo}>
                  <div className={style.cardTitle}>{item.name}</div>
                  <div className={style.cardMeta}>
                    <span className={style.cardAuthor}>
                      作者: {item.author}
                    </span>
                    <span className={style.cardModel}>机型: {item.model}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(item)}
                  className={style.downloadBtn}
                  disabled={downloadingId === item.id}
                >
                  下载
                </button>
              </div>
              {item.description && (
                <div className={style.cardDesc}>{item.description}</div>
              )}
              <span className={style.cardTime}>
                {item.timestamp
                  ? new Date(item.timestamp).toLocaleString(undefined, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '-'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {showPublishModal && (
        <div
          className={style.publishOverlay}
          onClick={() => setShowPublishModal(false)}
        >
          <div
            className={style.publishModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={style.publishHeader}>
              <h3>发布新程序</h3>
              <button
                className={style.closeButton}
                onClick={() => setShowPublishModal(false)}
              >
                <Svg size={16} icon="close" />
                关闭
              </button>
            </div>
            <div className={style.publishBody}>
              <div className={style.formGroup}>
                <label>
                  文件名<span className={style.required}>*</span>
                </label>
                <input
                  type="text"
                  value={publishName}
                  onChange={(e) => setPublishName(e.target.value)}
                  className={style.formInput}
                  placeholder="请输入文件名"
                />
              </div>
              <div className={style.formGroup}>
                <label>
                  作者<span className={style.required}>*</span>
                </label>
                <input
                  type="text"
                  value={publishAuthor}
                  onChange={(e) => setPublishAuthor(e.target.value)}
                  className={style.formInput}
                  placeholder="请输入作者名"
                />
              </div>
              <div className={style.formGroup}>
                <label>
                  机型<span className={style.required}>*</span>
                </label>
                <select
                  value={publishModel}
                  onChange={(e) => setPublishModel(e.target.value)}
                  className={style.formSelect}
                >
                  <option value="">请选择机型</option>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                  <option value="other">其他</option>
                </select>
              </div>
              {publishModel === 'other' && (
                <div className={style.formGroup}>
                  <label>
                    其他机型<span className={style.required}>*</span>
                  </label>
                  <input
                    type="text"
                    value={publishOtherModel}
                    onChange={(e) => setPublishOtherModel(e.target.value)}
                    className={style.formInput}
                    placeholder="请输入其他机型"
                  />
                </div>
              )}
              <div className={style.formGroupWide}>
                <label>
                  描述<span className={style.required}>*</span>
                </label>
                <textarea
                  value={publishDescription}
                  onChange={(e) => setPublishDescription(e.target.value)}
                  className={style.formTextarea}
                  rows="8"
                  placeholder="可选描述"
                />
              </div>
            </div>
            <div className={style.publishActions}>
              <button
                onClick={() => setShowPublishModal(false)}
                className={style.secondaryButton}
              >
                取消
              </button>
              <button
                onClick={handlePublish}
                className={style.primaryButton}
                disabled={publishing}
              >
                确认发布
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
