import { useState, useRef, useCallback, useEffect } from 'react';
import style from './styles/App.module.scss';
import InputPanel from './InputPanel';
import HexPanel from './HexPanel';
import NewFilePanel from './NewFilePanel';

const IDE_VERSION = 11;

export default function RopIDE() {
  const [isFileOpen, setIsFileOpen] = useState(false);
  const [fileHandle, setFileHandle] = useState(null);

  const [input, setInput] = useState('');
  const [hexDisplay, setHexDisplay] = useState([]);
  const [selectedByte, setSelectedByte] = useState(null);
  const [selectedInput, setSelectedInput] = useState(null);
  const [byteToInputMap, setByteToInputMap] = useState([]);
  const [currentFileName, setCurrentFileName] = useState('未命名.rop');
  const [leftStartAddress, setLeftStartAddress] = useState('E9E0');
  const [rightStartAddress, setRightStartAddress] = useState('D710');
  const [isDirty, setIsDirty] = useState(false);
  const [gadgets, setGadgets] = useState([]);
  const [showNewFilePanel, setShowNewFilePanel] = useState(false);

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
    setIsDirty(true); // 新文件默认是需要保存的
    setShowNewFilePanel(false);
  };

  const openFile = async () => {
    if (isDirty && !confirm('是否放弃当前更改并打开新文件？')) {
      return;
    }

    if (!('showOpenFilePicker' in window)) {
      alert('您的浏览器不支持文件系统访问API，无法打开文件。');
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
      const fileData = JSON.parse(await file.text());

      setInput(fileData.input || '');
      setSelectedInput(null);
      setSelectedByte(null);
      setCurrentFileName(_fileHandle.name || '未命名.rop');
      setLeftStartAddress(fileData.leftStartAddress || '0000');
      setRightStartAddress(fileData.rightStartAddress || '0000');
      setGadgets(fileData.gadgets || []);
      setIsDirty(false);
    } catch (err) {
      alert('解析文件时出错，文件可能已经损坏或格式错误。');
      return;
    }

    setIsFileOpen(true);
    setFileHandle(_fileHandle);
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
      return;
    }

    if (fileHandle && fileHandle.name === currentFileName) {
      // 直接写入已打开的文件
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      setIsDirty(false);
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
      return;
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
    }
  };

  const handleInputChange = (value) => {
    setInput(value);
    setIsDirty(true);
  };

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

  // 根据当前文件名更新标题
  useEffect(() => {
    if (currentFileName) {
      document.title = `RopIDE - ${currentFileName}`;
    }
  }, [currentFileName]);

  // 监听Ctrl+S或Cmd+S保存文件
  useEffect(() => {
    const handleKeyDown = (e) => {
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

      <div className={style.toolbar}>
        <button
          className={style.fileButton}
          onClick={createNewFile}
          title="创建新文件"
        >
          新建
        </button>
        <button
          className={style.fileButton}
          onClick={openFile}
          title="打开文件"
        >
          打开
        </button>
        <button
          className={`${style.fileButton} ${isDirty ? style.highlight : ''}`}
          onClick={saveFile}
          title="保存文件 (Ctrl+S)"
        >
          保存
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
            gadgets={gadgets}
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
    </>
  );
}
