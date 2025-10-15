import { useState, useCallback, useRef, useEffect } from 'react';
import Svg from './svg';
import style from './styles/GadgetManager.module.scss';

export default function GadgetManager({ gadgets, onUpdateGadgets, onClose }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingGadget, setEditingGadget] = useState(null);
  const [newTag, setNewTag] = useState({ name: '', type: 'info' });
  const gadgetListRef = useRef(null);
  const previousGadgetsCount = useRef(gadgets.length);

  // 滚动到底部的函数
  const scrollToBottom = useCallback(() => {
    if (gadgetListRef.current) {
      gadgetListRef.current.scrollTo({
        top: gadgetListRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  const handleAddGadget = useCallback(() => {
    const newGadget = {
      name: '新Gadget',
      addr: '',
      desc: '',
      tags: [],
    };
    const updatedGadgets = [...gadgets, newGadget];
    onUpdateGadgets(updatedGadgets);
    // 添加后直接进入编辑模式
    setEditingIndex(updatedGadgets.length - 1);
    setEditingGadget(newGadget);
  }, [gadgets, onUpdateGadgets]);

  // 检查gadgets数量变化，如果增加则滚动到底部
  useEffect(() => {
    if (gadgets.length > previousGadgetsCount.current) {
      // 延迟执行滚动，确保DOM已经更新
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 10);
      return () => clearTimeout(timer);
    }
    previousGadgetsCount.current = gadgets.length;
  }, [gadgets.length, scrollToBottom]);

  const handleDeleteGadget = useCallback(
    (index) => {
      if (window.confirm('确定要删除这个Gadget吗？')) {
        const updatedGadgets = gadgets.filter((_, i) => i !== index);
        onUpdateGadgets(updatedGadgets);
        // 如果正在编辑的项被删除，退出编辑模式
        if (editingIndex === index) {
          setEditingIndex(null);
          setEditingGadget(null);
        } else if (editingIndex > index) {
          // 如果删除的项在正在编辑的项之前，调整编辑索引
          setEditingIndex(editingIndex - 1);
        }
      }
    },
    [gadgets, onUpdateGadgets, editingIndex]
  );

  const handleEditGadget = useCallback((gadget, index) => {
    // 确保所有标签都有类型
    const gadgetWithProperTags = {
      ...gadget,
      tags: gadget.tags
        ? gadget.tags.map((tag) => ({
            ...tag,
            type: tag.type || 'info', // 默认为info类型
          }))
        : [],
    };
    setEditingIndex(index);
    setEditingGadget(gadgetWithProperTags);
  }, []);

  const handleSaveGadget = useCallback(() => {
    if (editingIndex !== null) {
      const updatedGadgets = [...gadgets];
      updatedGadgets[editingIndex] = editingGadget;
      onUpdateGadgets(updatedGadgets);
      setEditingIndex(null);
      setEditingGadget(null);
    }
  }, [gadgets, editingGadget, editingIndex, onUpdateGadgets]);

  const handleCancelEdit = useCallback(() => {
    // 如果是新添加的 gadget 并且取消了，需要删除它
    if (
      editingGadget &&
      editingGadget.name === '新Gadget' &&
      editingGadget.addr === '' &&
      editingGadget.desc === '' &&
      editingGadget.tags.length === 0
    ) {
      const updatedGadgets = gadgets.filter((_, i) => i !== editingIndex);
      onUpdateGadgets(updatedGadgets);
    }
    setEditingIndex(null);
    setEditingGadget(null);
  }, [gadgets, editingGadget, editingIndex, onUpdateGadgets]);

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
    <div className={style.overlay}>
      <div className={style.managerPanel}>
        <div className={style.header}>
          <h2>Gadgets管理</h2>
          <div className={style.panelActions}>
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
          {gadgets.map((gadget, index) => (
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function GadgetCard({
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
}) {
  if (isEditing && editingGadget) {
    return (
      <div className={style.gadgetCard}>
        <div className={style.cardHeader}>
          <input
            type="text"
            value={editingGadget.name}
            onChange={(e) => onChange('name', e.target.value)}
            className={style.nameInput}
            placeholder="名称"
          />
        </div>

        <div className={style.formGroup}>
          <label>地址:</label>
          <input
            type="text"
            value={editingGadget.addr}
            onChange={(e) => onChange('addr', e.target.value)}
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
              <option value="info">信息</option>
              <option value="warn">警告</option>
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
    <div className={style.gadgetCard}>
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
