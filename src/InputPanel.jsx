import { useState, useEffect, useCallback, useRef } from 'react';
import style from './styles/InputPanel.module.scss';

export default function InputPanel({
  input,
  onInputChange,
  onSelectionInputChange,
  byteToInputMap,
  selectedInput,
  onClearSelection,
  showAutocomplete,
  setShowAutocomplete,
  gadgets,
  onCheckGadget,
}) {
  const [textareaRef, setTextareaRef] = useState(null);
  const [cursorPosition, setCursorPosition] = useState({ start: 0, end: 0 });
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [autocompletePosition, setAutocompletePosition] = useState({
    top: 0,
    left: 0,
  });

  const highlightedContentRef = useRef(null);
  const editorRef = useRef(null);

  // 生成高亮HTML
  const generateHighlightedHTML = useCallback(
    (code) => {
      if (!code) return [];

      const lines = code.split('\n');
      const htmlLines = [];

      const newSegment = (text, type) =>
        `<span class="${type.map((t) => style[t]).join(' ')}">${text}</span>`;

      lines.forEach((line, lineIndex) => {
        const htmlLine = [];

        if (!line) {
          htmlLines.push(`<div data-line-index="${lineIndex}"> </div>`);
          return;
        }

        // 拆分行尾的注释 (//...)
        const [, beforeComment, comment = ''] = line.match(
          /^([^\/]*)(\/\/.*)?$/
        ) || [, line];

        // 拆分 gadget 与非 gadget 片段
        const parts = beforeComment.split(/(#[^;]*;|\s+)/);
        parts.forEach((part) => {
          if (!part) return;

          // 如果是 gadget 片段
          if (part.startsWith('#')) {
            // 如果是未闭合的 gadget
            if (!part.endsWith(';')) {
              htmlLine.push(newSegment(part, ['gadget', 'unclosed']));
              return;
            }

            if (
              part.slice(1, 2) === '-'
                ? gadgets.find((g) => g.name === part.slice(2, -1))
                : gadgets.find((g) => g.name === part.slice(1, -1))
            ) {
              htmlLine.push(newSegment(part, ['gadget']));
            } else {
              htmlLine.push(newSegment(part, ['gadget', 'undefined']));
            }
            return;
          }

          // 剩下的再按十六进制切分
          const hexParts = part.split(/([0-9a-fA-F\s]+)/);
          hexParts.forEach((sub) => {
            if (!sub) return;
            const type = /^[0-9a-fA-F\s]+$/.test(sub) ? ['code'] : ['comment'];
            htmlLine.push(newSegment(sub, type));
          });
        });

        // 把整段“//xxx”追加为注释
        if (comment) {
          htmlLine.push(newSegment(comment, ['comment']));
        }

        htmlLines.push(
          `<div data-line-index="${lineIndex}">${htmlLine.join('')}</div>`
        );
      });

      return htmlLines.join('');
    },
    [gadgets]
  );

  // 滚动输入框到选中位置
  const scrollTextareaToSelection = useCallback(
    (position) => {
      if (!editorRef.current) return;

      // 获取当前行的位置
      const text = input;
      const lines = text.substr(0, position).split('\n');
      const lineIndex = lines.length - 1;

      // 计算行高（近似值）
      const lineHeight = 20; // 假设每行高度为20px

      // 计算滚动位置，使选中行在视图中间
      const scrollPosition =
        lineIndex * lineHeight -
        editorRef.current.clientHeight / 2 +
        lineHeight;

      // 确保滚动位置在有效范围内
      const maxScroll =
        editorRef.current.scrollHeight - editorRef.current.clientHeight;
      const targetScroll = Math.max(0, Math.min(scrollPosition, maxScroll));

      // 平滑滚动到目标位置
      editorRef.current.scrollTop = targetScroll;
    },
    [input]
  );

  const findByte = useCallback(
    (start, end) => {
      if (!byteToInputMap || !Array.isArray(byteToInputMap)) {
        return null;
      }

      for (let rowIndex = 0; rowIndex < byteToInputMap.length; rowIndex++) {
        const row = byteToInputMap[rowIndex];
        if (!row) continue;

        for (let byteIndex = 0; byteIndex < row.length; byteIndex++) {
          const mapping = row[byteIndex];
          if (!mapping) continue;

          for (const char of mapping) {
            if (char && char.inputIndex >= start && char.inputIndex < end) {
              return { rowIndex, byteIndex };
            }
          }
        }
      }
      return null;
    },
    [byteToInputMap]
  );

  // 处理输入框选择事件和光标移动事件
  const handleTextareaSelect = useCallback(
    (e) => {
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;

      setCursorPosition({ start, end });

      if (start === end) {
        // 光标移动到某个位置（没有选择文本）
        const found = findByte(start, start + 1);
        onSelectionInputChange(found);
        return;
      }

      // 选择了文本
      const found = findByte(start, end);
      onSelectionInputChange(found);
    },
    [findByte, onSelectionInputChange]
  );

  // 处理键盘事件，确保方向键移动也能触发高亮
  const handleKeyUp = useCallback(
    (e) => {
      onClearSelection();

      // 只处理方向键、Home、End等导航键
      const navKeys = [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
        'PageUp',
        'PageDown',
      ];
      if (navKeys.includes(e.key)) {
        const pos = e.target.selectionStart;
        const found = findByte(pos, pos + 1);
        onSelectionInputChange(found);
        setCursorPosition({ start: pos, end: pos });
      }
    },
    [findByte, onSelectionInputChange, onClearSelection]
  );

  const handleClick = useCallback(
    (e) => {
      onClearSelection();

      const pos = e.target.selectionStart;
      const found = findByte(pos, pos + 1);
      onSelectionInputChange(found);
      setCursorPosition({ start: pos, end: pos });
    },
    [findByte, onSelectionInputChange, onClearSelection]
  );

  const handleScroll = useCallback(
    (e) => {
      if (highlightedContentRef.current && textareaRef) {
        highlightedContentRef.current.scrollTop = e.target.scrollTop;
        highlightedContentRef.current.scrollLeft = e.target.scrollLeft;
      }

      // 更新autocomplete面板的位置
      if (showAutocomplete && autocompletePosition) {
        const cursorPos = textareaRef.selectionStart;
        const { top, left } = getCursorPosition(textareaRef, cursorPos);
        setAutocompletePosition({ top, left });
      }
    },
    [textareaRef, showAutocomplete, autocompletePosition]
  );

  // 当输入内容变化时，更新高亮显示
  useEffect(() => {
    if (highlightedContentRef.current) {
      const html = generateHighlightedHTML(input);
      highlightedContentRef.current.innerHTML = html;
    }
  }, [input, generateHighlightedHTML]);

  // 当十六进制字节被选中时，高亮输入框中对应的内容
  useEffect(() => {
    if (!selectedInput || !textareaRef) return;

    const { start, end } = selectedInput;
    textareaRef.focus();
    textareaRef.setSelectionRange(start, end);
    setCursorPosition({ start, end });

    // 滚动输入框到选中位置
    scrollTextareaToSelection(start);
  }, [selectedInput, textareaRef, scrollTextareaToSelection]);

  const handleAutocomplete = (text) => {
    const cursorPos = textareaRef.selectionStart;
    const beforeCursor = text.substring(0, cursorPos);
    const [, beforeComment] = beforeCursor.match(/^([^\/]*)(\/\/.*)?$/) || [
      ,
      beforeCursor,
    ];
    const match = beforeComment.match(/#([a-zA-Z0-9-]*)$/);

    if (match) {
      if (!gadgets.length) return;

      const query = match[1];
      const allow00 = !query.startsWith('-');

      const filteredSuggestions = gadgets
        .map((g) => {
          if (!allow00) {
            return { ...g, name: `-${g.name}` };
          }
          return g;
        })
        .filter((g) => g.name.toLowerCase().includes(query.toLowerCase()));

      setSuggestions(filteredSuggestions);
      setShowAutocomplete(filteredSuggestions.length > 0);
      setSelectedSuggestionIndex(0);

      const { top, left } = getCursorPosition(textareaRef, cursorPos);
      setAutocompletePosition({ top, left });
    } else {
      setShowAutocomplete(false);
    }
  };

  const getCursorPosition = (textarea, cursorPos) => {
    if (!textarea) return { top: 0, left: 0 };

    // 创建一个临时的div来模拟textarea
    const div = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    [
      'width',
      'overflow',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'fontStyle',
      'letterSpacing',
      'lineHeight',
      'padding',
      'whiteSpace',
      'wordWrap',
      'wordBreak',
    ].forEach((prop) => {
      div.style[prop] = style[prop];
    });
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';

    const text = textarea.value.substring(0, cursorPos);
    div.textContent = text;

    // 创建一个span来标记光标位置
    const span = document.createElement('span');
    span.textContent = '|'; // 使用一个字符来模拟光标
    div.appendChild(span);

    document.body.appendChild(div);

    // 计算相对于textarea可视区域的坐标
    const top = span.offsetTop + span.offsetHeight - textarea.scrollTop;
    const left = span.offsetLeft - textarea.scrollLeft;

    document.body.removeChild(div);

    // 返回相对于textarea可视区域的坐标
    return { top, left };
  };

  const handleSuggestionSelect = (suggestion) => {
    const cursorPos = textareaRef.selectionStart;
    const textBeforeCursor = input.substring(0, cursorPos);
    const match = textBeforeCursor.match(/#([a-zA-Z0-9-]*)$/);

    if (match) {
      const startIndex = match.index;

      textareaRef.focus();
      textareaRef.setSelectionRange(startIndex, cursorPos);
      document.execCommand('insertText', false, `#${suggestion.name};`);

      setShowAutocomplete(false);
    }
  };

  const handleKeyDown = (e) => {
    if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex((prevIndex) =>
          Math.min(prevIndex + 1, suggestions.length - 1)
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex((prevIndex) => Math.max(prevIndex - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (suggestions[selectedSuggestionIndex]) {
          handleSuggestionSelect(suggestions[selectedSuggestionIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowAutocomplete(false);
      }
    }
  };

  return (
    <div className={style.inputPanel} ref={editorRef}>
      <div className={style.codeEditorContainer}>
        <div
          className={style.highlightedContent}
          ref={highlightedContentRef}
        ></div>
        <textarea
          ref={setTextareaRef}
          value={input}
          onChange={(e) => {
            onInputChange(e.target.value);
            handleAutocomplete(e.target.value);
            setCursorPosition({
              start: e.target.selectionStart,
              end: e.target.selectionEnd,
            });
          }}
          onSelect={handleTextareaSelect}
          onClick={handleClick}
          onKeyUp={handleKeyUp}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          placeholder="输入ROP代码..."
          className={style.codeInput}
          spellCheck="false"
        />
        {showAutocomplete && (
          <AutocompletePanel
            suggestions={suggestions}
            onSelect={handleSuggestionSelect}
            selectedIndex={selectedSuggestionIndex}
            style={autocompletePosition}
            onCheckGadget={onCheckGadget}
            setShowAutocomplete={setShowAutocomplete}
          />
        )}
      </div>
    </div>
  );
}

function AutocompletePanel({
  suggestions,
  onSelect,
  selectedIndex,
  style: positionStyle,
  onCheckGadget,
  setShowAutocomplete,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (panelRef.current && selectedIndex !== null) {
      const selectedItem = panelRef.current.children[selectedIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'center' });
      }
    }
  }, [selectedIndex]);

  if (!suggestions.length) {
    return null;
  }

  return (
    <div
      className={style.autocompletePanel}
      style={positionStyle}
      ref={panelRef}
    >
      {suggestions.map((suggestion, index) => (
        <div
          key={suggestion.name}
          className={`${style.suggestionItem} ${
            index === selectedIndex ? style.selected : ''
          }`}
          onClick={() => onSelect(suggestion)}
        >
          <span className={style.name}>{suggestion.name}</span>
          <span className={style.addr}>{suggestion.addr}</span>
          {suggestion.tags.map((tag) => (
            <span key={tag.name} className={`${style.tag} ${style[tag.color]}`}>
              {tag.name}
            </span>
          ))}
          <span className={style.desc}>{suggestion.desc?.split('\n')[0]}</span>
          <button
            className={style.arrowButton}
            onClick={(e) => {
              e.stopPropagation();
              setShowAutocomplete(false);
              onCheckGadget(suggestion);
            }}
          >
            →
          </button>
        </div>
      ))}
    </div>
  );
}
