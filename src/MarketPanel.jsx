import { useEffect, useMemo, useState } from 'react';
import Svg from './svg';
import style from './styles/MarketPanel.module.scss';
import { useTranslation, useLanguage } from './i18n';

const modelOptions = ['fx-991CNX (VerC)', 'fx-991CNX (VerF)'];

const normalizeName = (name, t) => {
  if (!name) return t('market.unnamed');
  return name.replace(/\.rop$/i, '');
};

const formatTime = (timestamp) =>
  timestamp
    ? new Date(timestamp).toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

const DownloadIcon = ({ size }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3v10.5" />
    <path d="M7.5 9 12 13.5 16.5 9" />
    <path d="M4.5 17v3.5h15V17" />
  </svg>
);

const MarketCard = ({ item, isFeatured, onDownload, onOpen, downloadingId, t }) => {
  return (
    <div
      className={`${style.marketCard} ${isFeatured ? style.featured : ''}`}
      onClick={() => onOpen(item)}
    >
      <div className={style.cardHeader}>
        <div className={style.cardInfo}>
          <div className={style.cardTitle}>{item.name}</div>
          <div className={style.cardMeta}>
            <span className={style.cardAuthor}>{t('market.author', { author: item.author })}</span>
            <span className={style.cardModel}>{t('market.modelLabel', { model: item.model })}</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload(item);
          }}
          className={style.downloadBtn}
          disabled={downloadingId === item.id}
          title={t('market.download')}
          aria-label={t('market.download')}
        >
          <DownloadIcon size={18} />
        </button>
      </div>
      {item.description && <div className={style.cardDesc}>{item.description}</div>}
      <div className={style.cardFooter}>
        <span className={style.cardComments}>
          <Svg size={14} icon="comment" />
          {item.commentCount || 0}
        </span>
        <span className={style.cardTime}>{formatTime(item.timestamp)}</span>
      </div>
    </div>
  );
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
  const t = useTranslation();
  const { formatDate } = useLanguage();
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
  const [challenge, setChallenge] = useState(null);
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);

  const loadMarketList = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/market');
      if (!res.ok) {
        throw new Error(t('market.emptyList'));
      }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      addMessage(e.message || t('market.emptyList'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchChallenge = async () => {
    setChallengeLoading(true);
    try {
      const res = await fetch('/api/market?challenge=true');
      if (!res.ok) {
        throw new Error();
      }
      const data = await res.json();
      setChallenge(data);
    } catch {
      setChallenge(null);
    } finally {
      setChallengeLoading(false);
    }
  };

  const openPublishModal = () => {
    setShowPublishModal(true);
    setChallengeAnswer('');
    fetchChallenge();
  };

  useEffect(() => {
    if (show) {
      loadMarketList();
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;
    setPublishName(normalizeName(currentFileName, t));
    setPublishDescription('');
    setShowPublishModal(false);
    setDetailItem(null);
  }, [show, currentFileName, t]);

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

  const featuredItems = useMemo(() => {
    return filteredItems.filter((item) => item.featured);
  }, [filteredItems]);

  const normalItems = useMemo(() => {
    return filteredItems.filter((item) => !item.featured);
  }, [filteredItems]);

  const handlePublish = async () => {
    const name = publishName.trim();
    const model =
      publishModel.trim() === 'other'
        ? publishOtherModel.trim()
        : publishModel.trim();

    if (!name) {
      addMessage(t('market.enterFileName'), 'error');
      return;
    }
    if (!publishAuthor.trim()) {
      addMessage(t('market.enterAuthor'), 'error');
      return;
    }
    if (!model) {
      addMessage(t('market.selectModel'), 'error');
      return;
    }
    if (!publishDescription.trim()) {
      addMessage(t('market.enterDesc'), 'error');
      return;
    }
    if (!currentFileData) {
      addMessage(t('market.noFileData'), 'error');
      return;
    }
    const normalizedAnswer = challengeAnswer
      .replace(/[^0-9a-fA-F]/g, '')
      .toLowerCase();
    if (!challenge) {
      addMessage(t('market.challengeLoadFailed'), 'error');
      fetchChallenge();
      return;
    }
    if (!/^[0-9a-f]{4}$/.test(normalizedAnswer)) {
      addMessage(t('market.challengeInvalid'), 'error');
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
        challengeToken: challenge.token,
        challengeAnswer: normalizedAnswer,
      };
      const res = await fetch('/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 410) {
          addMessage(
            res.status === 403
              ? t('market.challengeWrong')
              : t('market.challengeExpired'),
            'error',
          );
          setChallengeAnswer('');
          await fetchChallenge();
          return;
        }
        throw new Error(t('market.publishFailed'));
      }
      addMessage(t('market.publishSuccess'), 'info');
      setShowPublishModal(false);
      await loadMarketList();
    } catch (e) {
      addMessage(e.message || t('market.publishFailed'), 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleDownload = async (item) => {
    if (!item?.id) return;
    setDownloadingId(item.id);
    try {
      const res = await fetch(`/api/market?id=${item.id}`);
      if (!res.ok) {
        throw new Error(t('market.downloadFailed'));
      }
      const data = await res.json();
      if (!data?.data) {
        throw new Error(t('market.fileEmpty'));
      }
      const fileData = JSON.parse(data.data);
      onLoadFile(fileData, item.name);
    } catch (e) {
      addMessage(e.message || t('market.downloadFailed'), 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const loadComments = async (fileId) => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/comments?fileId=${fileId}`);
      if (!res.ok) {
        throw new Error(t('market.commentLoadFailed'));
      }
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []);
    } catch (e) {
      setComments([]);
      addMessage(e.message || t('market.commentLoadFailed'), 'error');
    } finally {
      setCommentsLoading(false);
    }
  };

  const openDetail = (item) => {
    setDetailItem(item);
    setComments([]);
    setCommentContent('');
    setShowCommentForm(false);
    loadComments(item.id);
  };

  const closeDetail = () => setDetailItem(null);

  const handleSubmitComment = async () => {
    if (!detailItem) return;
    const author = commentAuthor.trim();
    const content = commentContent.trim();
    if (!author) {
      addMessage(t('market.commentAuthorRequired'), 'error');
      return;
    }
    if (!content) {
      addMessage(t('market.commentContentRequired'), 'error');
      return;
    }
    setSubmittingComment(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: detailItem.id, author, content }),
      });
      if (!res.ok) {
        throw new Error(t('market.commentSubmitFailed'));
      }
      const created = await res.json();
      setComments((prev) => [created, ...prev]);
      setCommentContent('');
      setShowCommentForm(false);
      const bump = (item) =>
        item.id === detailItem.id
          ? { ...item, commentCount: (item.commentCount || 0) + 1 }
          : item;
      setItems((prev) => prev.map(bump));
      setDetailItem((prev) => (prev ? bump(prev) : prev));
      addMessage(t('market.commentSubmitSuccess'), 'info');
    } catch (e) {
      addMessage(e.message || t('market.commentSubmitFailed'), 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (!show) return null;

  return (
    <div className={style.overlay}>
      <div className={style.marketPanel}>
        <div className={style.header}>
          <h2>{t('market.title')}</h2>
          <div className={style.panelActions}>
            <div className={style.searchContainer}>
              <input
                type="text"
                placeholder={t('market.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={style.searchInput}
              />
            </div>
            {withPublishBtn && (
              <button
                onClick={openPublishModal}
                className={style.primaryButton}
              >
                <Svg size={16} icon="add" />
                {t('market.publish')}
              </button>
            )}
            <button
              onClick={onClose}
              className={style.closeButton}
              title={t('market.close')}
              aria-label={t('market.close')}
            >
              <Svg size={18} icon="close" />
            </button>
          </div>
        </div>

        <div className={style.marketList}>
          {filteredItems.length === 0 && (
            <div className={style.emptyState}>
              {loading ? t('market.loading') : t('market.empty')}
            </div>
          )}

          {featuredItems.length > 0 && (
            <>
              <div className={style.sectionHeader}>
                <span className={style.sectionTitle}>{t('market.featured')}</span>
                <span className={style.sectionCount}>{featuredItems.length}</span>
              </div>
              {featuredItems.map((item) => (
                <MarketCard
                  key={item.id}
                  item={item}
                  isFeatured={true}
                  onDownload={handleDownload}
                  onOpen={openDetail}
                  downloadingId={downloadingId}
                  t={t}
                />
              ))}
            </>
          )}

          {normalItems.length > 0 && featuredItems.length > 0 && (
            <div className={style.divider}>
              <span className={style.dividerText}>{t('market.normal')}</span>
            </div>
          )}

          {normalItems.length > 0 && (
            <>
              {featuredItems.length === 0 && (
                <div className={style.sectionHeader}>
                  <span className={style.sectionTitle}>{t('market.normal')}</span>
                  <span className={style.sectionCount}>{normalItems.length}</span>
                </div>
              )}
              {normalItems.map((item) => (
                <MarketCard
                  key={item.id}
                  item={item}
                  isFeatured={false}
                  onDownload={handleDownload}
                  onOpen={openDetail}
                  downloadingId={downloadingId}
                  t={t}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {showPublishModal && (
        <div className={style.publishOverlay}>
          <div className={style.publishModal}>
            <div className={style.publishHeader}>
              <h3>{t('market.publishTitle')}</h3>
              <button
                className={style.closeButton}
                onClick={() => setShowPublishModal(false)}
                title={t('market.close')}
                aria-label={t('market.close')}
              >
                <Svg size={18} icon="close" />
              </button>
            </div>
            <div className={style.publishBody}>
              <div className={style.formGroup}>
                <label>
                  {t('market.fileName')}<span className={style.required}>{t('market.required')}</span>
                </label>
                <input
                  type="text"
                  value={publishName}
                  onChange={(e) => setPublishName(e.target.value)}
                  className={style.formInput}
                  placeholder={t('market.fileName')}
                />
              </div>
              <div className={style.formGroup}>
                <label>
                  {t('market.authorName')}<span className={style.required}>{t('market.required')}</span>
                </label>
                <input
                  type="text"
                  value={publishAuthor}
                  onChange={(e) => setPublishAuthor(e.target.value)}
                  className={style.formInput}
                  placeholder={t('market.authorName')}
                />
              </div>
              <div className={style.formGroup}>
                <label>
                  {t('market.modelSelect')}<span className={style.required}>{t('market.required')}</span>
                </label>
                <select
                  value={publishModel}
                  onChange={(e) => setPublishModel(e.target.value)}
                  className={style.formSelect}
                >
                  <option value="">{t('market.modelPlaceholder')}</option>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                  <option value="other">{t('market.otherModel')}</option>
                </select>
              </div>
              {publishModel === 'other' && (
                <div className={style.formGroup}>
                  <label>
                    {t('market.otherModelLabel')}<span className={style.required}>{t('market.required')}</span>
                  </label>
                  <input
                    type="text"
                    value={publishOtherModel}
                    onChange={(e) => setPublishOtherModel(e.target.value)}
                    className={style.formInput}
                    placeholder={t('market.otherModelPlaceholder')}
                  />
                </div>
              )}
              <div className={style.formGroupWide}>
                <label>
                  {t('market.description')}<span className={style.required}>{t('market.required')}</span>
                </label>
                <textarea
                  value={publishDescription}
                  onChange={(e) => setPublishDescription(e.target.value)}
                  className={style.formTextarea}
                  rows="8"
                  placeholder={t('market.descriptionPlaceholder')}
                />
              </div>
              <div className={style.formGroupWide}>
                <label>
                  {t('market.challengeTitle')}<span className={style.required}>{t('market.required')}</span>
                </label>
                <div className={style.challengeHint}>
                  {challengeLoading
                    ? t('market.challengeLoading')
                    : challenge
                      ? t('market.challengeHint', {
                          offset: `0x${challenge.offset
                            .toString(16)
                            .toUpperCase()
                            .padStart(4, '0')}`,
                        })
                      : t('market.challengeLoadFailed')}
                </div>
                <input
                  type="text"
                  value={challengeAnswer}
                  onChange={(e) => setChallengeAnswer(e.target.value)}
                  className={style.formInput}
                  maxLength={9}
                  placeholder={t('market.challengePlaceholder')}
                  disabled={!challenge}
                />
              </div>
            </div>
            <div className={style.publishActions}>
              <button
                onClick={() => setShowPublishModal(false)}
                className={style.cancelButton}
              >
                {t('admin.cancel')}
              </button>
              <button
                onClick={handlePublish}
                className={style.primaryButton}
                disabled={publishing || challengeLoading}
              >
                {t('market.confirmPublish')}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailItem && (
        <div className={style.publishOverlay}>
          <div className={`${style.publishModal} ${style.detailModal}`}>
            <div className={style.publishHeader}>
              <h3 className={style.detailTitle}>{detailItem.name}</h3>
              <button
                className={style.closeButton}
                onClick={closeDetail}
                title={t('market.close')}
                aria-label={t('market.close')}
              >
                <Svg size={18} icon="close" />
              </button>
            </div>

            <div className={style.detailMeta}>
              <span>{t('market.author', { author: detailItem.author })}</span>
              <span>{t('market.modelLabel', { model: detailItem.model })}</span>
            </div>

            {detailItem.description && (
              <div className={style.detailDesc}>{detailItem.description}</div>
            )}

            <div className={style.detailTime}>
              {formatTime(detailItem.timestamp)}
            </div>

            <div className={style.commentsSection}>
              <div className={style.commentsHeader}>
                <Svg size={16} icon="comment" />
                <span>{`${t('market.comments')} (${detailItem.commentCount || 0})`}</span>
              </div>

              <div className={style.commentList}>
                {commentsLoading ? (
                  <div className={style.commentsEmpty}>
                    {t('market.loading')}
                  </div>
                ) : comments.length === 0 ? (
                  <div className={style.commentsEmpty}>
                    {t('market.noComments')}
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className={style.commentItem}>
                      <div className={style.commentTop}>
                        <span className={style.commentAuthor}>
                          {comment.author}
                        </span>
                        <span className={style.commentTime}>
                          {formatTime(comment.timestamp)}
                        </span>
                      </div>
                      <div className={style.commentContent}>
                        {comment.content}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {showCommentForm ? (
                <div className={style.commentForm}>

                  <input
                    type="text"
                    className={style.formInput}
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    placeholder={t('market.commentAuthorPlaceholder')}
                    maxLength={50}
                  />
                  <textarea
                    className={style.formTextarea}
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder={t('market.commentContentPlaceholder')}
                    rows={3}
                    maxLength={1000}
                  />
                  <div className={style.commentFormActions}>
                    <button
                      className={style.cancelButton}
                      onClick={() => setShowCommentForm(false)}
                    >
                      {t('market.cancelComment')}
                    </button>
                    <button
                      className={style.primaryButton}
                      onClick={handleSubmitComment}
                      disabled={submittingComment}
                    >
                      {t('market.submitComment')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={style.commentFormActions}>
                  <button
                    className={style.primaryButton}
                    onClick={() => setShowCommentForm(true)}
                  >
                    <Svg size={16} icon="add" />
                    {t('market.newComment')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
