import { useState, useRef, useCallback, useEffect } from 'react';
import style from './styles/App.module.scss';
import InputPanel from './InputPanel';
import HexPanel from './HexPanel';
import NewFilePanel from './NewFilePanel';
import GadgetManager from './GadgetManager';

const IDE_VERSION = 13;

const upgradeOldFile = (fileData) => {
  if (fileData.ideVersion === 10) {
    return {
      ...fileData,
      ideVersion: IDE_VERSION,
    };
  }

  if (fileData.ideVersion === 11) {
    const newGadgets = fileData.gadgets.map((gadget) => {
      let tags = [];
      if (gadget.rt) {
        tags.push({ name: 'RT', type: 'warn' });
      }
      gadget.pops.forEach((pop) => {
        tags.push({ name: pop, type: 'info' });
      });
      return {
        name: gadget.name,
        addr: gadget.addr,
        desc: gadget.desc,
        tags,
      };
    });

    return {
      ...fileData,
      gadgets: newGadgets,
      ideVersion: IDE_VERSION,
    };
  }

  if (fileData.ideVersion === 12) {
    const newGadgets = fileData.gadgets.map((gadget) => {
      const newTags = gadget.tags.map((tag) => {
        let newType;
        switch (tag.type) {
          case 'info':
            newType = 'blue';
            break;
          case 'warn':
            newType = 'orange';
            break;
          default:
            newType = 'gray';
            break;
        }

        return {
          name: tag.name,
          type: newType,
        };
      });

      return {
        name: gadget.name,
        addr: gadget.addr,
        desc: gadget.desc,
        tags: newTags,
      };
    });

    return {
      ...fileData,
      gadgets: newGadgets,
      ideVersion: IDE_VERSION,
    };
  }
};

export default function App() {
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
  const [highlightedGadget, setHighlightedGadget] = useState(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  const [messages, setMessages] = useState([]);

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
        const oldIdeVersion = fileData.ideVersion;
        fileData = upgradeOldFile(fileData);

        addMessage(
          `已自动升级文件版本 (${oldIdeVersion}→${IDE_VERSION})`,
          'warn'
        );
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
  };

  const saveFile = async () => {
    const fileData = {
      input,
      leftStartAddress,
      rightStartAddress,
      gadgets,
      ideVersion: IDE_VERSION,
    };

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
    []
  );

  const handleHexDisplayChange = useCallback(
    (newHexDisplay, newByteToInputMap) => {
      setHexDisplay(newHexDisplay);
      setByteToInputMap(newByteToInputMap);
    },
    []
  );

  const handleGadgetsUpdate = useCallback((updatedGadgets) => {
    setGadgets(updatedGadgets);
    setIsDirty(true);
  }, []);

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

  // 根据当前文件名更新标题
  useEffect(() => {
    if (currentFileName) {
      document.title = `RopIDE - ${currentFileName}`;
    }
  }, [currentFileName]);

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

  if (!isFileOpen) {
    return (
      <>
        <NewFilePanel
          show={showNewFilePanel}
          isDirty={isDirty}
          onClose={() => setShowNewFilePanel(false)}
          onConfirm={handleNewFileConfirm}
        />

        <div className={style.welcomeContainer}>
          <h1>欢迎使用 RopIDE</h1>
          <p>开始一个新的项目或打开一个现有的项目</p>
          <div className={style.buttonContainer}>
            <button className={style.welcomeButton} onClick={createNewFile}>
              创建新文件
            </button>
            <button className={style.welcomeButton} onClick={openFile}>
              打开文件
            </button>
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

      <div className={style.toolbar}>
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
      </div>

      <div className={style.pageContainer}>
        <div className={style.editorContainer}>
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
          />

          <HexPanel
            input={input}
            hexDisplay={hexDisplay}
            selectedByte={selectedByte}
            byteToInputMap={byteToInputMap}
            leftStartAddress={leftStartAddress}
            rightStartAddress={rightStartAddress}
            setLeftStartAddress={setLeftStartAddress}
            setRightStartAddress={setRightStartAddress}
            onSelectedByteChange={handleSelectionByteChange}
            onHexDisplayChange={handleHexDisplayChange}
            gadgets={gadgets}
          />
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
