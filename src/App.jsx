import { useState, useRef, useCallback, useEffect } from 'react';
import style from './App.module.scss';
import InputPanel from './InputPanel';
import HexPanel from './HexPanel';

const IDE_VERSION = 10;

export default function RopIDE() {
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
  const [gadgetsLoading, setGadgetsLoading] = useState(false); // 新增状态，跟踪gadgets加载状态
  const fileInputRef = useRef(null);

  const createNewFile = () => {
    if (input && !confirm('是否放弃当前更改并创建新文件？')) {
      return;
    }
    setInput('');
    setSelectedInput(null);
    setSelectedByte(null);
    setCurrentFileName('未命名.rop');
  };

  const openFile = () => {
    if (input && !confirm('是否放弃当前更改并打开新文件？')) {
      return;
    }
    fileInputRef.current.click();
  };

  const handleFileNameChange = (e) => {
    setCurrentFileName(e.target.value);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const fileData = JSON.parse(event.target.result);
        setInput(fileData.input || '');
        setLeftStartAddress(fileData.leftStartAddress || 'E9E0');
        setRightStartAddress(fileData.rightStartAddress || 'D710');
        setCurrentFileName(file.name);
      } catch (error) {
        alert('文件格式错误，无法打开！');
        console.error('文件解析错误:', error);
      }
    };
    reader.readAsText(file);
    e.target.value = null; // 重置文件输入，允许重新选择同一文件
  };

  const saveFile = async () => {
    const fileData = {
      input,
      leftStartAddress,
      rightStartAddress,
      ideVersion: IDE_VERSION,
    };

    const jsonString = JSON.stringify(fileData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // 尝试使用现代的File System Access API
    try {
      if ('showSaveFilePicker' in window) {
        const options = {
          suggestedName: currentFileName,
          types: [
            {
              description: 'ROP文件',
              accept: { 'application/json': ['.rop'] },
            },
          ],
        };

        const fileHandle = await window.showSaveFilePicker(options);
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        setIsDirty(false);
        return;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
    }

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

  // 加载 gadgets.json 文件
  useEffect(() => {
    setGadgetsLoading(true);
    fetch('./gadgets.json')
      .then((response) => response.json())
      .then((data) => {
        setGadgets(data);
        setGadgetsLoading(false);
      })
      .catch((error) => {
        console.error('加载 gadgets.json 失败:', error);
        setGadgetsLoading(false);
      });
  }, []);

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

  return (
    <>
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
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".rop"
          onChange={handleFileSelect}
        />
        <button
          className={style.fileButton}
          onClick={saveFile}
          title="保存文件"
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

      <div className={style.statusBar}>
        <div
          className={`${style.statusBarItem} ${
            gadgetsLoading ? style.yellow : ''
          }`}
        >
          {gadgetsLoading ? (
            <>
              <span className={style.loadingSpinner}></span>
              正在加载 gadgets...
            </>
          ) : (
            `已加载 ${gadgets.length} 个 gadgets`
          )}
        </div>
      </div>
    </>
  );
}
