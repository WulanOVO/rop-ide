import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Svg from './svg';
import style from './styles/GadgetManager.module.scss';

export default function GadgetManager({
  gadgets,
  onUpdateGadgets,
  onClose,
  highlightedGadget,
  setHighlightedGadget,
}) {
  const [localGadgets, setLocalGadgets] = useState(gadgets);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingGadget, setEditingGadget] = useState(null);
  const [newTag, setNewTag] = useState({ name: '', type: 'blue' });
  const [searchTerm, setSearchTerm] = useState('');

  const gadgetListRef = useRef(null);
  const highlightedGadgetRef = useRef(null);

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

  const handleCancelEdit = useCallback(() => {
    setLocalGadgets(gadgets);
    setEditingIndex(null);
    setEditingGadget(null);
    setHighlightedGadget(null);
  }, [gadgets, setHighlightedGadget]);

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

  const handleEditGadget = useCallback((gadget, index) => {
    setLocalGadgets(gadgets);
    setEditingIndex(index);
    setEditingGadget(gadget);
    setHighlightedGadget(gadget);
  }, []);

  const handleDeleteGadget = useCallback(
    (index) => {
      if (!window.confirm('确定要删除这个Gadget吗？')) {
        return;
      }

      if (editingIndex === index) {
        handleCancelEdit();
        return;
      }

      const updatedGadgets = localGadgets.filter((_, i) => i !== index);
      setLocalGadgets(updatedGadgets);
      onUpdateGadgets(updatedGadgets);

      // 如果删除的项在正在编辑的项之前，调整编辑索引
      if (editingIndex > index) {
        setEditingIndex(editingIndex - 1);
      }
    },
    [localGadgets, onUpdateGadgets, editingIndex]
  );

  const handleSaveGadget = useCallback(() => {
    if (editingIndex === null || !editingGadget) {
      return;
    }

    if (editingGadget.name.trim() === '') {
      alert('请输入Gadget名称！');
      return;
    } else if (editingGadget.addr.trim() === '') {
      alert('请输入Gadget地址！');
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
  }, [localGadgets, editingGadget, editingIndex, onUpdateGadgets]);

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
      setNewTag({ name: '', type: 'info' });
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

  return (
    <div className={style.overlay} onClick={onClose}>
      <div className={style.managerPanel} onClick={(e) => e.stopPropagation()}>
        <div className={style.header}>
          <h2>Gadgets管理</h2>
          <div className={style.panelActions}>
            <div className={style.searchContainer}>
              <input
                type="text"
                placeholder="搜索 gadgets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={style.searchInput}
              />
            </div>
            <button onClick={handleAddGadget} className={style.addButton}>
              <Svg size={16} icon="add" />
              添加Gadget
            </button>
            <button onClick={onClose} className={style.closeButton}>
              <Svg size={16} icon="close" />
              关闭
            </button>
          </div>
        </div>

        <div ref={gadgetListRef} className={style.gadgetList}>
          {filteredGadgets.map((gadget, index) => (
            <GadgetCard
              key={index}
              gadget={gadget}
              index={index}
              onEdit={() => handleEditGadget(gadget, index)}
              onDelete={() => handleDeleteGadget(index)}
              isEditing={editingIndex === index}
              editingGadget={editingIndex === index ? editingGadget : null}
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
            />
          ))}
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
}) {
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
            placeholder="名称"
          />
        </div>

        <div className={style.formGroup}>
          <label>地址:</label>
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
            placeholder="地址"
          />
        </div>

        <div className={style.formGroup}>
          <label>描述:</label>
          <textarea
            value={editingGadget.desc}
            onChange={(e) => onChange('desc', e.target.value)}
            className={style.formTextarea}
            rows="4"
            placeholder="描述"
          />
        </div>

        <div className={style.formGroup}>
          <label>标签:</label>
          <div className={style.tagsContainer}>
            {editingGadget.tags &&
              editingGadget.tags.map((tag, tagIndex) => (
                <span
                  key={tagIndex}
                  className={`${style.tag} ${style[tag.type] || style.info} ${
                    style.tagWithRemove
                  }`}
                >
                  {tag.name}
                  <button
                    onClick={() => onRemoveTag(tagIndex)}
                    className={style.removeTagButton}
                    title="移除标签"
                  >
                    <Svg size={14} icon="close" />
                  </button>
                </span>
              ))}
          </div>

          <div className={style.addTagForm}>
            <input
              type="text"
              placeholder="标签名称"
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
              value={newTag.type}
              onChange={(e) => onTagChange('type', e.target.value)}
              className={style.tagSelect}
            >
              <option value="blue">蓝色</option>
              <option value="orange">橙色</option>
            </select>
            <button onClick={onAddTag} className={style.addButton}>
              <Svg size={16} icon="add" />
              添加
            </button>
          </div>
        </div>

        <div className={style.cardActions}>
          <button onClick={onSave} className={style.saveButton} title="保存">
            <Svg size={16} icon="ok" />
          </button>
          <button
            onClick={onCancel}
            className={style.cancelButton}
            title="取消"
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
      }`}
      ref={ref}
    >
      <div className={style.cardActions}>
        <button onClick={onEdit} className={style.iconButton} title="编辑">
          <Svg size={16} icon="edit" />
        </button>
        <button onClick={onDelete} className={style.iconButton} title="删除">
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
                className={`${style.tag} ${style[tag.type] || style.info}`}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <span className={style.gadgetAddress}>地址: {gadget.addr}</span>

      <p className={style.gadgetDesc}>{gadget.desc}</p>
    </div>
  );
}
