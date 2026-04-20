import { useState, useRef, useCallback, useEffect } from 'react';
import style from './styles/App.module.scss';
import InputPanel from './InputPanel';
import HexPanel from './HexPanel';
import NewFilePanel from './NewFilePanel';
import GadgetManager from './GadgetManager';
import MarketPanel from './MarketPanel';
import { parseRopInput } from './parser';

const IDE_VERSION = 100;

const upgradeOldFile = (fileData) => {
  if (fileData.ideVersion < 100) {
    const messages = [['已自动升级文件到最新版本', 'warn']];
    if (fileData.gadgets) {
      messages.push(['测试版 Gadgets 已停止支持', 'warn']);
    }
    return {
      newFileData: {
        input: fileData.input,
        leftStartAddress: fileData.leftStartAddress,
        rightStartAddress: fileData.rightStartAddress,
        gadgets: [],
        ideVersion: IDE_VERSION,
      },
      messages,
    };
  }
};

export default function App() {
  const toolbarRef = useRef(null);

  const [isFileOpen, setIsFileOpen] = useState(false);
  const [fileHandle, setFileHandle] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  const [input, setInput] = useState('');
  const [hexDisplay, setHexDisplay] = useState([]);
  const [selectedByte, setSelectedByte] = useState(null);
  const [selectedInput, setSelectedInput] = useState(null);
  const [byteToInputMap, setByteToInputMap] = useState([]);
  const [currentFileName, setCurrentFileName] = useState('未命名.rop');
  const [leftStartAddress, setLeftStartAddress] = useState('E9E0');
  const [rightStartAddress, setRightStartAddress] = useState('D710');
  const [gadgets, setGadgets] = useState([]);
  const [showNewFilePanel, setShowNewFilePanel] = useState(false);
  const [showGadgetManager, setShowGadgetManager] = useState(false);
  const [showMarketPanel, setShowMarketPanel] = useState(false);
  const [highlightedGadget, setHighlightedGadget] = useState(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [parsedInput, setParsedInput] = useState({
    highlightLines: [],
    hexChars: '',
    charPosInInputMap: [],
    errorCount: 0,
  });

  const [messages, setMessages] = useState([]);
  const [newFileCount, setNewFileCount] = useState(0);
  const [marketIds, setMarketIds] = useState([]);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [activeMobilePanel, setActiveMobilePanel] = useState('input');
  const [editorViewportHeight, setEditorViewportHeight] = useState(null);

  // 获取市场文件ID列表
  useEffect(() => {
    const checkNewFiles = async () => {
      try {
        const res = await fetch('/api/market?idOnly=true');
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;

        const currentIds = data.map((item) => item.id);
        setMarketIds(currentIds);

        const seenIds = JSON.parse(
          localStorage.getItem('rop-ide-market-ids') || '[]',
        );
        const newCount = currentIds.filter(
          (id) => !seenIds.includes(id),
        ).length;
        setNewFileCount(newCount);
      } catch (e) {
        console.error('Failed to check market updates', e);
      }
    };

    checkNewFiles();
  }, []);

  useEffect(() => {
    const updateLayout = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const nextIsNarrowScreen = viewportWidth <= 900;

      setIsNarrowScreen(nextIsNarrowScreen);
      if (!nextIsNarrowScreen) {
        setActiveMobilePanel('input');
      }

      if (toolbarRef.current) {
        const toolbarBottom = toolbarRef.current.getBoundingClientRect().bottom;
        const nextHeight = Math.max(Math.floor(viewportHeight - toolbarBottom - 16), 280);
        setEditorViewportHeight(nextHeight);
      }
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    window.visualViewport?.addEventListener('resize', updateLayout);

    return () => {
      window.removeEventListener('resize', updateLayout);
      window.visualViewport?.removeEventListener('resize', updateLayout);
    };
  }, [isFileOpen]);

  const handleOpenMarket = () => {
    setShowMarketPanel(true);

    if (marketIds.length > 0) {
      localStorage.setItem('rop-ide-market-ids', JSON.stringify(marketIds));
      setNewFileCount(0);
    }
  };

  const addMessage = useCallback((message, type = 'info') => {
    const newMessage = {
      id: Date.now() + Math.random(), // 确保唯一性
      message,
      type,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);

    // 3秒后自动移除消息
    setTimeout(() => {
      setMessages((prev) => prev.filter((msg) => msg.id !== newMessage.id));
    }, 3000);
  }, []);

  const removeMessage = useCallback((id) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  }, []);

  const createNewFile = () => {
    setShowNewFilePanel(true);
  };

  const handleNewFileConfirm = (settings) => {
    setIsFileOpen(true);
    setInput('');
    setSelectedInput(null);
    setSelectedByte(null);
    setCurrentFileName(settings.fileName);
    setLeftStartAddress(settings.leftAddress);
    setRightStartAddress(settings.rightAddress);
    setGadgets(settings.gadgets);
    setIsDirty(true);
    setShowNewFilePanel(false);
    setShowAutocomplete(false);

    addMessage(`文件 "${settings.fileName}" 创建成功`, 'info');
  };

  const openFile = async () => {
    if (isDirty && !confirm('是否放弃当前更改并打开新文件？')) {
      return;
    }

    if (!('showOpenFilePicker' in window)) {
      addMessage('当前浏览器不支持文件选择功能，建议使用最新版Chrome', 'error');
      return;
    }

    const [_fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'ROP文件',
          accept: { 'application/json': ['.rop'] },
        },
      ],
      multiple: false,
    });
    const file = await _fileHandle.getFile();

    try {
      let fileData = JSON.parse(await file.text());

      if (fileData.ideVersion < IDE_VERSION) {
        const { newFileData, messages } = upgradeOldFile(fileData);
        fileData = newFileData;

        messages.forEach((message) => addMessage(...message));
        setIsDirty(true);
      } else if (fileData.ideVersion === IDE_VERSION) {
        setIsDirty(false);
      } else {
        throw '文件版本错误';
      }

      setInput(fileData.input || '');
      setSelectedInput(null);
      setSelectedByte(null);
      setCurrentFileName(_fileHandle.name || '未命名.rop');
      setLeftStartAddress(fileData.leftStartAddress || '0000');
      setRightStartAddress(fileData.rightStartAddress || '0000');
      setGadgets(fileData.gadgets || []);

      addMessage(`文件 "${_fileHandle.name}" 打开成功`, 'info');
    } catch (err) {
      addMessage('文件打开失败，请检查文件格式', 'error');
      return;
    }

    setIsFileOpen(true);
    setFileHandle(_fileHandle);
    setShowAutocomplete(false);
  };

  const handleFileNameChange = (e) => {
    setCurrentFileName(e.target.value);
    setIsDirty(true);
  };

  const getCurrentFileData = useCallback(
    () => ({
      input,
      leftStartAddress,
      rightStartAddress,
      gadgets,
      ideVersion: IDE_VERSION,
    }),
    [input, leftStartAddress, rightStartAddress, gadgets],
  );

  const saveFile = async () => {
    const fileData = getCurrentFileData();

    const jsonString = JSON.stringify(fileData, null);
    const blob = new Blob([jsonString], { type: 'application/json' });

    if (!('showSaveFilePicker' in window)) {
      // 回退到传统下载方式
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsDirty(false);
      addMessage('文件保存成功', 'info');
      return;
    }

    if (fileHandle && fileHandle.name === currentFileName) {
      // 直接写入已打开的文件
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      setIsDirty(false);
      addMessage('文件保存成功', 'info');
      return;
    }

    // 保存新文件
    try {
      const options = {
        suggestedName: currentFileName,
        types: [
          {
            description: 'ROP文件',
            accept: { 'application/json': ['.rop'] },
          },
        ],
      };

      const _fileHandle = await window.showSaveFilePicker(options);
      const writable = await _fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      setIsDirty(false);
      setFileHandle(_fileHandle);
      addMessage('文件保存成功', 'info');
      return;
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
      addMessage('文件保存失败', 'error');
    }
  };

  const handleInputChange = (value) => {
    setInput(value);
    setIsDirty(true);
  };

  const handleCheckGadget = useCallback((gadget) => {
    setShowGadgetManager(true);
    setHighlightedGadget(gadget);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedByte(null);
    setSelectedInput(null);
  }, []);

  const handleSelectionInputChange = useCallback((newSelectedByte) => {
    setSelectedByte(newSelectedByte);
  }, []);

  const handleSelectionByteChange = useCallback(
    (newSelectedByte, newSelectedInput) => {
      setSelectedByte(newSelectedByte);
      setSelectedInput(newSelectedInput);
    },
    [],
  );

  const handleHexDisplayChange = useCallback(
    (newHexDisplay, newByteToInputMap) => {
      setHexDisplay(newHexDisplay);
      setByteToInputMap(newByteToInputMap);
    },
    [],
  );

  const handleLeftAddrChange = useCallback((newAddr) => {
    setLeftStartAddress(newAddr);
    setIsDirty(true);
  }, []);

  const handleRightAddrChange = useCallback((newAddr) => {
    setRightStartAddress(newAddr);
    setIsDirty(true);
  }, []);

  const handleGadgetsUpdate = useCallback((updatedGadgets) => {
    setGadgets(updatedGadgets);
    setIsDirty(true);
  }, []);

  const handleLoadMarketFile = useCallback(
    (fileData, name) => {
      if (isDirty && !confirm('是否放弃当前更改并打开新文件？')) {
        return;
      }

      let normalizedData = fileData;
      if (normalizedData.ideVersion < IDE_VERSION) {
        const { newFileData, messages } = upgradeOldFile(normalizedData);
        normalizedData = newFileData;
        messages.forEach((message) => addMessage(...message));
      } else if (normalizedData.ideVersion !== IDE_VERSION) {
        addMessage('文件版本错误', 'error');
        return;
      }

      const fileName = name?.endsWith('.rop') ? name : `${name}.rop`;

      setInput(normalizedData.input || '');
      setSelectedInput(null);
      setSelectedByte(null);
      setCurrentFileName(fileName || '未命名.rop');
      setLeftStartAddress(normalizedData.leftStartAddress || '0000');
      setRightStartAddress(normalizedData.rightStartAddress || '0000');
      setGadgets(normalizedData.gadgets || []);
      setIsDirty(true);
      setIsFileOpen(true);
      setFileHandle(null);
      setShowAutocomplete(false);
      setShowMarketPanel(false);
      addMessage(`文件 "${fileName || '未命名.rop'}" 打开成功`, 'info');
    },
    [isDirty, addMessage, setShowMarketPanel],
  );

  // 根据当前文件名更新标题
  useEffect(() => {
    if (isFileOpen) {
      document.title = `RopIDE - ${currentFileName}`;
    }
  }, [currentFileName, isFileOpen]);

  // 全局监听快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + O
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        openFile();
      }
      // Ctrl + S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveFile]);

  // 监听窗口关闭事件，提示用户保存未保存的更改
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.returnValue = '您确定要离开吗？所有未保存的更改都将丢失。';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // 当输入或gadgets改变时重新解析输入
  useEffect(() => {
    const { highlightLines, hexChars, charPosInInputMap, errorCount } =
      parseRopInput(input, gadgets, {
        leftStartAddress,
        rightStartAddress,
      });

    // 更新解析后的数据
    setParsedInput({ highlightLines, hexChars, charPosInInputMap, errorCount });

    // 处理hexDisplay和byteToInputMap的更新
    let processedHexChars = hexChars.length > 0 ? hexChars : '00';
    if (charPosInInputMap.length === 0) {
      charPosInInputMap.push(0);
      charPosInInputMap.push(0);
    }

    const hexRows = [];
    const byteMapping = [];

    for (let i = 0; i < processedHexChars.length; i += 32) {
      const chunk = processedHexChars.slice(i, i + 32).padEnd(32, '0');
      const bytes = [];
      const byteMappingRow = [];

      for (let j = 0; j < chunk.length; j += 2) {
        const byte = chunk.substring(j, j + 2);
        bytes.push(byte);

        const firstCharPos = charPosInInputMap[i + j];
        const secondCharPos = charPosInInputMap[i + j + 1];

        byteMappingRow.push({
          start: firstCharPos,
          end: secondCharPos,
        });
      }

      hexRows.push(bytes);
      byteMapping.push(byteMappingRow);
    }

    setHexDisplay(hexRows);
    setByteToInputMap(byteMapping);
  }, [input, gadgets, leftStartAddress, rightStartAddress]);

  if (!isFileOpen) {
    return (
      <>
        <NewFilePanel
          show={showNewFilePanel}
          isDirty={isDirty}
          onClose={() => setShowNewFilePanel(false)}
          onConfirm={handleNewFileConfirm}
        />

        {showMarketPanel && (
          <MarketPanel
            show={showMarketPanel}
            onClose={() => setShowMarketPanel(false)}
            currentFileData={getCurrentFileData()}
            currentFileName={currentFileName}
            onLoadFile={handleLoadMarketFile}
            addMessage={addMessage}
          />
        )}

        <div className={style.welcomeContainer}>
          <h1>欢迎使用 RopIDE</h1>
          <p className={style.welcomeInfo}>
            开始一个新的项目或打开一个现有的项目
          </p>
          <div className={style.buttonContainer}>
            <button className={style.welcomeButton} onClick={createNewFile}>
              创建新文件
            </button>
            <button className={style.welcomeButton} onClick={openFile}>
              打开文件
            </button>
            <div className={style.marketEntryContainer}>
              <button
                className={`${style.welcomeButton} ${
                  newFileCount > 0 ? style.marketButton : ''
                }`}
                onClick={handleOpenMarket}
              >
                程序广场
                {newFileCount > 0 && (
                  <span
                    className={style.newBadge}
                  >{`${newFileCount}个新程序`}</span>
                )}
              </button>
            </div>
          </div>

          <div className={style.footer}>
            <p>
              在找 xe1010ce20 的项目吗？
              <a
                href="https://rop-ide.pages.dev"
                target="_blank"
                rel="noopener noreferrer"
              >
                友谊链接
              </a>
            </p>
            <p>
              Copyright &copy; {new Date().getFullYear()}
              <a
                href="https://github.com/WulanOVO/rop-ide"
                target="_blank"
                rel="noopener noreferrer"
              >
                RopIDE
              </a>
              &nbsp; @wlyibo
            </p>
          </div>

          <div className={style.versionInfo}>
            <p>v2.0.1</p>
          </div>
        </div>

        <MessagePanel messages={messages} onRemoveMessage={removeMessage} />
      </>
    );
  }

  return (
    <>
      <NewFilePanel
        show={showNewFilePanel}
        isDirty={isDirty}
        onClose={() => setShowNewFilePanel(false)}
        onConfirm={handleNewFileConfirm}
      />

      {showGadgetManager && (
        <GadgetManager
          gadgets={gadgets}
          onUpdateGadgets={handleGadgetsUpdate}
          onClose={() => {
            setShowGadgetManager(false);
            setHighlightedGadget(null);
          }}
          highlightedGadget={highlightedGadget}
          setHighlightedGadget={setHighlightedGadget}
        />
      )}

      {showMarketPanel && (
        <MarketPanel
          show={showMarketPanel}
          withPublishBtn={isFileOpen}
          onClose={() => setShowMarketPanel(false)}
          currentFileData={getCurrentFileData()}
          currentFileName={currentFileName}
          onLoadFile={handleLoadMarketFile}
          addMessage={addMessage}
        />
      )}

      <div className={style.toolbar} ref={toolbarRef}>
        <button
          className={style.toolbarButton}
          onClick={createNewFile}
          title="创建新文件"
        >
          新建
        </button>
        <button
          className={style.toolbarButton}
          onClick={openFile}
          title="打开文件 (Ctrl+O)"
        >
          打开
        </button>
        <button
          className={`${style.toolbarButton} ${isDirty ? style.highlight : ''}`}
          onClick={saveFile}
          title="保存文件 (Ctrl+S)"
        >
          保存
        </button>
        <button
          className={style.toolbarButton}
          onClick={() => {
            setShowGadgetManager(true);
            setShowAutocomplete(false);
          }}
          title="管理Gadgets"
        >
          {`Gadgets管理 (${gadgets.length})`}
        </button>
        <input
          type="text"
          className={style.currentFileName}
          value={currentFileName}
          onChange={handleFileNameChange}
        />
        <button
          className={`${style.toolbarButton} ${style.marketButton} ${style.toolbarMarketButton}`}
          onClick={() => {
            setShowMarketPanel(true);
            setShowAutocomplete(false);
          }}
          title="在线查看和发布程序"
        >
          程序广场
        </button>
      </div>

      <div
        className={`${style.pageContainer} ${
          isNarrowScreen ? style.compactPageContainer : ''
        }`}
        style={
          editorViewportHeight
            ? { height: `${editorViewportHeight}px` }
            : undefined
        }
      >
        {isNarrowScreen && (
          <div className={style.mobilePanelTabs}>
            <button
              className={`${style.mobilePanelTab} ${
                activeMobilePanel === 'input' ? style.activeMobilePanelTab : ''
              }`}
              onClick={() => setActiveMobilePanel('input')}
            >
              代码编辑
            </button>
            <button
              className={`${style.mobilePanelTab} ${
                activeMobilePanel === 'hex' ? style.activeMobilePanelTab : ''
              }`}
              onClick={() => setActiveMobilePanel('hex')}
            >
              十六进制
            </button>
          </div>
        )}

        <div
          className={`${style.editorContainer} ${
            isNarrowScreen ? style.mobileEditorContainer : ''
          }`}
        >
          {(!isNarrowScreen || activeMobilePanel === 'input') && (
            <div className={`${style.panelHost} ${style.inputPanelHost}`}>
              <InputPanel
                input={input}
                onInputChange={handleInputChange}
                onSelectionInputChange={handleSelectionInputChange}
                byteToInputMap={byteToInputMap}
                selectedInput={selectedInput}
                onClearSelection={handleClearSelection}
                showAutocomplete={showAutocomplete}
                setShowAutocomplete={setShowAutocomplete}
                gadgets={gadgets}
                onCheckGadget={handleCheckGadget}
                parsedInput={parsedInput}
              />
            </div>
          )}

          {(!isNarrowScreen || activeMobilePanel === 'hex') && (
            <div className={`${style.panelHost} ${style.hexPanelHost}`}>
              <HexPanel
                input={input}
                hexDisplay={hexDisplay}
                selectedByte={selectedByte}
                byteToInputMap={byteToInputMap}
                leftStartAddress={leftStartAddress}
                rightStartAddress={rightStartAddress}
                onLeftAddrChange={handleLeftAddrChange}
                onRightAddrChange={handleRightAddrChange}
                onSelectedByteChange={handleSelectionByteChange}
                onHexDisplayChange={handleHexDisplayChange}
                gadgets={gadgets}
                parsedInput={parsedInput}
              />
            </div>
          )}
        </div>
      </div>

      <MessagePanel messages={messages} onRemoveMessage={removeMessage} />
    </>
  );
}

function MessagePanel({ messages, onRemoveMessage }) {
  if (messages.length === 0) return null;

  return (
    <div className={style.messagePanel}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`${style.message} ${style[msg.type]}`}
          onClick={() => onRemoveMessage(msg.id)}
        >
          <span className={style.messageText}>{msg.message}</span>
          <span className={style.messageTime}>
            {msg.timestamp.toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
}
