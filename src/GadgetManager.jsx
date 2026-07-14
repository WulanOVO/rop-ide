import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Svg from './svg';
import style from './styles/GadgetManager.module.scss';
import { useTranslation } from './i18n';

export default function GadgetManager({
  gadgets,
  onUpdateGadgets,
  onClose,
  highlightedGadget,
  setHighlightedGadget,
}) {
  const t = useTranslation();
  const [localGadgets, setLocalGadgets] = useState(gadgets);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingGadget, setEditingGadget] = useState(null);
  const [newTag, setNewTag] = useState({ name: '', color: 'gray' });
  const [searchTerm, setSearchTerm] = useState('');

  const gadgetListRef = useRef(null);
  const highlightedGadgetRef = useRef(null);
  const scrollIntervalRef = useRef(null);

  // 添加滚动到高亮gadget的函数
  const scrollToHighlightedGadget = useCallback(() => {
    if (gadgetListRef.current && highlightedGadgetRef.current) {
      highlightedGadgetRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [highlightedGadgetRef]);

  // 当高亮gadget变化时滚动到该项
  useEffect(() => {
    if (highlightedGadget && gadgetListRef.current) {
      // 延迟执行以确保DOM更新
      const timer = setTimeout(() => {
        scrollToHighlightedGadget();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [highlightedGadget, scrollToHighlightedGadget]);

  // 边缘滚动函数
  const handleEdgeScroll = useCallback((e) => {
    if (!gadgetListRef.current) return;

    const container = gadgetListRef.current;
    const containerRect = container.getBoundingClientRect();
    const scrollThreshold = 60; // 距离边缘60px时开始滚动
    const scrollSpeed = 5; // 滚动速度

    const mouseY = e.clientY;
    const containerTop = containerRect.top;
    const containerBottom = containerRect.bottom;

    // 清除之前的滚动定时器
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }

    // 检查是否靠近顶部边缘
    if (mouseY - containerTop < scrollThreshold && container.scrollTop > 0) {
      scrollIntervalRef.current = setInterval(() => {
        if (container.scrollTop <= 0) {
          clearInterval(scrollIntervalRef.current);
          scrollIntervalRef.current = null;
          return;
        }
        container.scrollTop -= scrollSpeed;
      }, 16); // 约60fps
    }
    // 检查是否靠近底部边缘
    else if (
      containerBottom - mouseY < scrollThreshold &&
      container.scrollTop < container.scrollHeight - container.clientHeight
    ) {
      scrollIntervalRef.current = setInterval(() => {
        if (
          container.scrollTop >=
          container.scrollHeight - container.clientHeight
        ) {
          clearInterval(scrollIntervalRef.current);
          scrollIntervalRef.current = null;
          return;
        }
        container.scrollTop += scrollSpeed;
      }, 16); // 约60fps
    }
  }, []);

  // 停止边缘滚动
  const stopEdgeScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, []);

  // 根据搜索词过滤 gadgets
  const filteredGadgets = useMemo(() => {
    if (!searchTerm) return localGadgets;

    return localGadgets.filter(
      (gadget) =>
        gadget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gadget.addr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gadget.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gadget.tags.some((tag) =>
          tag.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );
  }, [localGadgets, searchTerm]);

  // 根据筛选列表中的索引找到原始列表中的索引
  const findOriginalIndex = useCallback((filteredIndex) => {
    if (!searchTerm) return filteredIndex;

    const filteredItem = filteredGadgets[filteredIndex];
    return localGadgets.findIndex((g) => g === filteredItem);
  }, [filteredGadgets, localGadgets, searchTerm]);

  const handleCancelEdit = useCallback(() => {
    setLocalGadgets(gadgets);
    setEditingIndex(null);
    setEditingGadget(null);
    setHighlightedGadget(null);
  }, [setHighlightedGadget, gadgets]);

  // 处理拖拽排序
  const handleDragStart = useCallback((e, index) => {
    e.dataTransfer.setData('text/plain', index);
    e.dataTransfer.effectAllowed = 'move';
    // 添加拖拽时的视觉反馈
    e.target.classList.add(style.dragging);
  }, []);

  const handleDragEnd = useCallback(
    (e) => {
      // 移除拖拽时的视觉反馈
      e.target.classList.remove(style.dragging);
      // 停止边缘滚动
      stopEdgeScroll();
    },
    [stopEdgeScroll]
  );

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // 处理边缘滚动
      handleEdgeScroll(e);
    },
    [handleEdgeScroll]
  );

  const handleDrop = useCallback(
    (e, dropIndex) => {
      e.preventDefault();
      // 移除拖拽时的视觉反馈
      e.target.classList.remove(style.dragging);
      // 停止边缘滚动
      stopEdgeScroll();

      const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);

      if (dragIndex !== dropIndex) {
        const newGadgets = [...localGadgets];
        const [draggedItem] = newGadgets.splice(dragIndex, 1);
        newGadgets.splice(dropIndex, 0, draggedItem);

        setLocalGadgets(newGadgets);
        onUpdateGadgets(newGadgets);
      }
    },
    [localGadgets, onUpdateGadgets, stopEdgeScroll]
  );

  const handleAddGadget = useCallback(() => {
    // 需要同步处理，不能调用handleCancelEdit
    // 移除正在编辑的gadget
    let currentGadgets = localGadgets;
    if (editingIndex !== null && editingIndex === localGadgets.length - 1) {
      currentGadgets = localGadgets.slice(0, -1);
    }

    const newGadget = {
      name: '',
      addr: '',
      desc: '',
      tags: [],
    };

    const updatedGadgets = [...currentGadgets, newGadget];
    setLocalGadgets(updatedGadgets);

    setEditingIndex(updatedGadgets.length - 1);
    setEditingGadget(newGadget);
    setHighlightedGadget(newGadget);
  }, [localGadgets, gadgets, setHighlightedGadget, editingIndex]);

  const handleEditGadget = useCallback((gadget, filteredIndex) => {
    const originalIndex = findOriginalIndex(filteredIndex);
    setEditingIndex(originalIndex);
    setEditingGadget(gadget);
    setHighlightedGadget(gadget);
  }, [findOriginalIndex]);

  const handleDeleteGadget = useCallback(
    (filteredIndex) => {
      const originalIndex = findOriginalIndex(filteredIndex);

      if (!window.confirm(t('gadget.confirmDelete'))) {
        return;
      }

      if (editingIndex === originalIndex) {
        handleCancelEdit();
        return;
      }

      const updatedGadgets = localGadgets.filter((_, i) => i !== originalIndex);
      setLocalGadgets(updatedGadgets);
      onUpdateGadgets(updatedGadgets);

      // 如果删除的项在正在编辑的项之前，调整编辑索引
      if (editingIndex !== null && editingIndex > originalIndex) {
        setEditingIndex(editingIndex - 1);
      }
    },
    [localGadgets, onUpdateGadgets, editingIndex, findOriginalIndex, t]
  );

  const handleSaveGadget = useCallback(() => {
    if (editingIndex === null || !editingGadget) {
      return;
    }

    if (editingGadget.name.trim() === '') {
      alert(t('gadget.nameRequired'));
      return;
    } else if (editingGadget.addr.trim() === '') {
      alert(t('gadget.addrRequired'));
      return;
    }

    // 转换地址为大写并在开头补0
    let formattedAddr = editingGadget.addr.toUpperCase();
    while (formattedAddr.length < 5) {
      formattedAddr = '0' + formattedAddr;
    }

    const gadgetToSave = {
      ...editingGadget,
      addr: formattedAddr,
    };

    const updatedLocalGadgets = [...localGadgets];
    updatedLocalGadgets[editingIndex] = gadgetToSave;
    setLocalGadgets(updatedLocalGadgets);
    onUpdateGadgets(updatedLocalGadgets);

    setEditingIndex(null);
    setEditingGadget(null);
    setHighlightedGadget(null);
  }, [localGadgets, editingGadget, editingIndex, onUpdateGadgets, t]);

  const handleGadgetChange = useCallback((field, value) => {
    setEditingGadget((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleTagChange = useCallback((field, value) => {
    setNewTag((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleAddTag = useCallback(() => {
    if (newTag.name.trim() !== '') {
      const updatedTags = [...editingGadget.tags, { ...newTag }];
      setEditingGadget((prev) => ({
        ...prev,
        tags: updatedTags,
      }));
      setNewTag({ name: '', color: 'gray' });
    }
  }, [editingGadget, newTag]);

  const handleRemoveTag = useCallback(
    (tagIndex) => {
      const updatedTags = editingGadget.tags.filter((_, i) => i !== tagIndex);
      setEditingGadget((prev) => ({
        ...prev,
        tags: updatedTags,
      }));
    },
    [editingGadget]
  );

  const handleExportGadgets = useCallback(() => {
    const dataStr = JSON.stringify(localGadgets);
    const dataUri =
      'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = 'gadgets.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [localGadgets]);

  return (
    <div className={style.overlay} onClick={onClose}>
      <div className={style.managerPanel} onClick={(e) => e.stopPropagation()}>
        <div className={style.header}>
          <h2>{t('gadget.title')}</h2>
          <div className={style.panelActions}>
            <div className={style.searchContainer}>
              <input
                type="text"
                placeholder={t('gadget.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={style.searchInput}
              />
            </div>
            <button
              onClick={handleExportGadgets}
              className={style.exportButton}
            >
              {t('gadget.export')}
            </button>
            <button onClick={handleAddGadget} className={style.addButton}>
              <Svg size={16} icon="add" />
              {t('gadget.add')}
            </button>
            <button onClick={onClose} className={style.closeButton}>
              <Svg size={16} icon="close" />
              {t('gadget.close')}
            </button>
          </div>
        </div>

        <div ref={gadgetListRef} className={style.gadgetList}>
          {filteredGadgets.map((gadget, filteredIndex) => {
            const originalIndex = findOriginalIndex(filteredIndex);
            return (
              <GadgetCard
                key={`${gadget.name}-${originalIndex}`}
                gadget={gadget}
                index={filteredIndex}
                onEdit={() => handleEditGadget(gadget, filteredIndex)}
                onDelete={() => handleDeleteGadget(filteredIndex)}
                isEditing={editingIndex === originalIndex}
                editingGadget={editingIndex === originalIndex ? editingGadget : null}
                onSave={handleSaveGadget}
                onCancel={handleCancelEdit}
                onChange={handleGadgetChange}
                onTagChange={handleTagChange}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                newTag={newTag}
                isHighlighted={
                  highlightedGadget && highlightedGadget.name === gadget.name
                }
                ref={
                  highlightedGadget && highlightedGadget.name === gadget.name
                    ? highlightedGadgetRef
                    : null
                }
                draggable={editingIndex === null}
                onDragStart={(e) => handleDragStart(e, originalIndex)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, originalIndex)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GadgetCard({
  ref,
  gadget,
  onEdit,
  onDelete,
  isEditing,
  editingGadget,
  onSave,
  onCancel,
  onChange,
  onTagChange,
  onAddTag,
  onRemoveTag,
  newTag,
  isHighlighted,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) {
  const t = useTranslation();

  if (isEditing && editingGadget) {
    return (
      <div
        className={`${style.gadgetCard} ${
          isHighlighted ? style.highlighted : ''
        }`}
        ref={ref}
        tabIndex="-1"
      >
        <div className={style.cardHeader}>
          <input
            type="text"
            value={editingGadget.name}
            onChange={(e) => {
              // 防止输入空格
              if (!/\s/.test(e.target.value)) {
                onChange('name', e.target.value);
              }
            }}
            className={style.nameInput}
            placeholder={t('gadget.name')}
          />
        </div>

        <div className={style.formGroup}>
          <label>{t('gadget.address')}</label>
          <input
            type="text"
            value={editingGadget.addr}
            onChange={(e) => {
              // 限制只能输入十六进制字符，且最多5位
              const value = e.target.value;
              if (/^[0-9A-Fa-f]*$/.test(value) && value.length <= 5) {
                onChange('addr', value);
              }
            }}
            className={style.formInput}
            placeholder={t('gadget.addressPlaceholder')}
          />
        </div>

        <div className={style.formGroup}>
          <label>{t('gadget.desc')}</label>
          <textarea
            value={editingGadget.desc}
            onChange={(e) => onChange('desc', e.target.value)}
            className={style.formTextarea}
            rows="4"
            placeholder={t('gadget.descPlaceholder')}
          />
        </div>

        <div className={style.formGroup}>
          <label>{t('gadget.tags')}</label>
          <div className={style.tagsContainer}>
            {editingGadget.tags &&
              editingGadget.tags.map((tag, tagIndex) => (
                <span
                  key={tagIndex}
                  className={`${style.tag} ${style[tag.color] || style.gray}`}
                >
                  {tag.name}
                  <button
                    onClick={() => onRemoveTag(tagIndex)}
                    className={style.removeTagButton}
                    title={t('gadget.removeTag')}
                  >
                    <Svg size={14} icon="close" />
                  </button>
                </span>
              ))}
          </div>

          <div className={style.addTagForm}>
            <input
              type="text"
              placeholder={t('gadget.tagName')}
              value={newTag.name}
              onChange={(e) => onTagChange('name', e.target.value)}
              className={style.tagInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAddTag();
                }
              }}
            />
            <select
              value={newTag.color}
              onChange={(e) => onTagChange('color', e.target.value)}
              className={style.tagSelect}
            >
              <option value="gray">{t('gadget.gray')}</option>
              <option value="blue">{t('gadget.blue')}</option>
              <option value="yellow">{t('gadget.yellow')}</option>
              <option value="orange">{t('gadget.orange')}</option>
              <option value="green">{t('gadget.green')}</option>
              <option value="purple">{t('gadget.purple')}</option>
            </select>
            <button onClick={onAddTag} className={style.addButton}>
              <Svg size={16} icon="add" />
              {t('gadget.addTag')}
            </button>
          </div>
        </div>

        <div className={style.cardActions}>
          <button onClick={onSave} className={style.saveButton} title={t('admin.save')}>
            <Svg size={16} icon="ok" />
          </button>
          <button
            onClick={onCancel}
            className={style.cancelButton}
            title={t('admin.cancel')}
          >
            <Svg size={16} icon="close" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${style.gadgetCard} ${
        isHighlighted ? style.highlighted : ''
      } ${draggable ? style.draggable : ''}`}
      ref={ref}
      // 拖拽相关属性
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className={style.cardActions}>
        <button onClick={onEdit} className={style.iconButton} title={t('gadget.edit')}>
          <Svg size={16} icon="edit" />
        </button>
        <button onClick={onDelete} className={style.iconButton} title={t('gadget.delete')}>
          <Svg size={16} icon="delete" />
        </button>
      </div>

      <div className={style.cardHeader}>
        <h3 className={style.gadgetName}>{gadget.name}</h3>
        {gadget.tags && gadget.tags.length > 0 && (
          <div className={style.tagsContainer}>
            {gadget.tags.map((tag, tagIndex) => (
              <span
                key={tagIndex}
                className={`${style.tag} ${style[tag.color] || style.gray}`}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <span className={style.gadgetAddress}>{t('gadget.address')} {gadget.addr}</span>

      <p className={style.gadgetDesc}>{gadget.desc}</p>
    </div>
  );
}
