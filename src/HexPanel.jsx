import { useState, useEffect, useCallback } from 'react';
import style from './styles/HexPanel.module.scss';

function HexDisplay({
  hexDisplay,
  leftStartAddress,
  rightStartAddress,
  selectedByte,
  onByteClick,
}) {
  const leftBaseAddr = parseInt(leftStartAddress || '0', 16);
  const rightBaseAddr = parseInt(rightStartAddress || '0', 16);

  const rows = hexDisplay.map((row, rowIndex) => {
    const leftAddr = leftBaseAddr + rowIndex * 16;
    const rightAddr = rightBaseAddr + rowIndex * 16;

    const leftAddrHex = leftAddr.toString(16).toUpperCase().padStart(4, '0');
    const rightAddrHex = rightAddr.toString(16).toUpperCase().padStart(4, '0');

    const byteElements = row.map((byte, byteIndex) => {
      const isSelected =
        selectedByte &&
        selectedByte.rowIndex === rowIndex &&
        selectedByte.byteIndex === byteIndex;

      const byteClassName = `${style.hexByte} ${
        byte === '00' ? style.zero : ''
      } ${isSelected ? style.selected : ''}`;

      return (
        <span
          key={byteIndex}
          className={byteClassName}
          onClick={() => onByteClick(rowIndex, byteIndex)}
        >
          {byte}
        </span>
      );
    });

    return (
      <div key={rowIndex} className={style.hexRow}>
        <span className={style.leftAddress}>{leftAddrHex}</span>
        <span className={style.hexBytes}>{byteElements}</span>
        <span className={style.rightAddress}>{rightAddrHex}</span>
      </div>
    );
  });

  return (
    <div className={style.hexDisplay} data-testid="hex-display">
      {rows}
    </div>
  );
}

export default function HexPanel({
  input,
  hexDisplay,
  selectedByte,
  byteToInputMap,
  onSelectedByteChange,
  onHexDisplayChange,
  leftStartAddress,
  rightStartAddress,
  setLeftStartAddress,
  setRightStartAddress,
  parsedInput,
}) {
  const [copyBtnText, setCopyBtnText] = useState('复制');

  const handleLeftAddressChange = useCallback((e) => {
    const value = e.target.value.toUpperCase();

    if (/^[0-9A-F]{0,4}$/.test(value)) {
      setLeftStartAddress(value);
    }
  }, []);

  const handleRightAddressChange = useCallback((e) => {
    const value = e.target.value.toUpperCase();

    if (/^[0-9A-F]{0,4}$/.test(value)) {
      setRightStartAddress(value);
    }
  }, []);

  const copyHexContent = useCallback(() => {
    if (parsedInput.errorCount > 0) {
      alert(`存在${parsedInput.errorCount}个语法错误，建议检查`);
    }

    const hexContent = hexDisplay.map((row) => row.join(' ')).join('\n');

    navigator.clipboard.writeText(hexContent).then(() => {
      setCopyBtnText('已复制✔');
      setTimeout(() => {
        setCopyBtnText('复制');
      }, 1500);
    });
  }, [hexDisplay]);

  // 寻找字节对应的输入区部分
  const findInputRange = useCallback(
    (bytePos) => {
      if (!bytePos) return { start: 0, end: 0 };

      const { rowIndex, byteIndex } = bytePos;
      const mapping = byteToInputMap[rowIndex][byteIndex];
      const start = mapping.start;
      const end = mapping.end;

      if (start === undefined || end === undefined) {
        return { start: 0, end: 0 };
      }

      return {
        start: start,
        end: end + 1,
      };
    },
    [byteToInputMap]
  );

  const handleByteClick = useCallback(
    (rowIndex, byteIndex) => {
      if (
        selectedByte &&
        selectedByte.rowIndex === rowIndex &&
        selectedByte.byteIndex === byteIndex
      ) {
        onSelectedByteChange(null, null);
        return;
      }

      const { start, end } = findInputRange({
        rowIndex,
        byteIndex,
      });
      onSelectedByteChange({ rowIndex, byteIndex }, { start, end });
    },
    [selectedByte, onSelectedByteChange, byteToInputMap, findInputRange]
  );

  // 计算选中字节的地址
  const getSelectedAddresses = useCallback(() => {
    if (!selectedByte) return { left: null, right: null };

    const leftAddr =
      parseInt(leftStartAddress || '0', 16) +
      selectedByte.rowIndex * 16 +
      selectedByte.byteIndex;
    const rightAddr =
      parseInt(rightStartAddress || '0', 16) +
      selectedByte.rowIndex * 16 +
      selectedByte.byteIndex;

    return {
      left: leftAddr.toString(16).toUpperCase().padStart(4, '0'),
      right: rightAddr.toString(16).toUpperCase().padStart(4, '0'),
    };
  }, [selectedByte, leftStartAddress, rightStartAddress]);

  useEffect(() => {
    const { hexChars, charPosInInputMap } = parsedInput;

    // 从App组件中移过来的处理逻辑
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

    onHexDisplayChange(hexRows, byteMapping);
  }, [input, onHexDisplayChange, parsedInput]);

  const countBytes = useCallback(() => {
    let count = 0;
    for (let i = hexDisplay.length - 1; i >= 0; i--) {
      for (let j = hexDisplay[i].length - 1; j >= 0; j--) {
        if (hexDisplay[i][j] !== '00' || count > 0) {
          count++;
        }
      }
    }
    return count;
  }, [hexDisplay]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && (e.shiftKey || e.altKey) && e.key === 'c') {
        e.preventDefault();
        copyHexContent();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className={style.hexPanel}>
      <div className={style.hexDisplaySetting}>
        <div className={style.addressInputContainer}>
          <label>左侧起始地址:</label>
          <input
            className={style.addressInput}
            value={leftStartAddress}
            onChange={handleLeftAddressChange}
          />
        </div>
        <div className={style.addressInputContainer}>
          <label>右侧起始地址:</label>
          <input
            className={style.addressInput}
            value={rightStartAddress}
            onChange={handleRightAddressChange}
          />
        </div>
        <button
          className={`${style.copyButton} ${
            parsedInput.errorCount > 0 ? style.error : ''
          }`}
          onClick={copyHexContent}
          title="复制全部十六进制内容 (Ctrl+Alt+C)"
        >
          {copyBtnText}
        </button>
      </div>

      <HexDisplay
        hexDisplay={hexDisplay}
        leftStartAddress={leftStartAddress}
        rightStartAddress={rightStartAddress}
        selectedByte={selectedByte}
        onByteClick={handleByteClick}
      />
      <div className={style.hexFootbar}>
        {selectedByte && (
          <div className={style.selectedAddresses}>
            选中地址:
            <span className={style.leftSelectedAddress}>
              {getSelectedAddresses().left}
            </span>
            <span className={style.rightSelectedAddress}>
              {getSelectedAddresses().right}
            </span>
          </div>
        )}

        <div className={style.bytesTotal}>字节总数: {countBytes()}</div>
      </div>
    </div>
  );
}
