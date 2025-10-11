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
  gadgets,
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
      if (
        !byteToInputMap ||
        !byteToInputMap[rowIndex] ||
        !byteToInputMap[rowIndex][byteIndex]
      ) {
        return { start: 0, end: 0 };
      }

      const mapping = byteToInputMap[rowIndex][byteIndex];
      const firstChar = mapping.firstChar;
      const secondChar = mapping.secondChar;

      if (!firstChar && !secondChar) {
        return { start: 0, end: 0 };
      }

      // 如果有两个字符位置，使用它们的范围
      if (firstChar && secondChar) {
        return {
          start: firstChar.inputIndex,
          end: secondChar.inputIndex + 1,
        };
      }

      // 如果只有一个字符位置，使用它的位置
      const char = firstChar || secondChar;
      return {
        start: char.inputIndex,
        end: char.inputIndex + 1,
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

  const getGadgetHex = useCallback((gadgetName, gadgets, allow00 = true) => {
    const gadget = gadgets.find((g) => g.name === gadgetName);
    if (!gadget) return '';
    const addr = gadget.addr || '';

    let hex = '';
    hex += addr.slice(3, 5);
    if (hex === '00' && !allow00) hex = '01';
    hex += addr.slice(1, 3);
    hex += `${allow00 ? '0' : '3'}${addr[0]}`;
    hex += allow00 ? '00' : '30';

    return hex.toUpperCase();
  }, []);

  // 解析ROP代码输入，将其转换为十六进制字符流，并生成原始位置的映射
  const parseInputToHex = (input, gadgets) => {
    const mapping = []; // 存储每个十六进制字符在原始输入中的位置
    let hexChars = ''; // 存储最终拼接的十六进制字符串
    let currentPosInInput = 0; // 跟踪处理到输入字符串的哪个位置

    const lines = input.split('\n');

    // 逐行解析输入
    lines.forEach((line, lineIndex) => {
      const lineStartPosInInput = currentPosInInput;
      let currentPosInLine = 0;

      // 忽略行尾的注释 (//...)
      const [, beforeComment] = line.match(/^([^/]*)(\/\/.*)?$/) || [, line];

      // 根据 gadget 与非 gadget 片段分割代码
      const parts = beforeComment.split(/(#[^;]*;|\s+)/);
      parts.forEach((part) => {
        if (!part) return;

        // 计算当前部分在行内的起始索引，用于后续精确定位
        const partStartIndexInLine = beforeComment.indexOf(
          part,
          currentPosInLine
        );
        currentPosInLine = partStartIndexInLine + part.length;
        const partStartPosInInput = lineStartPosInInput + partStartIndexInLine;

        // 如果是 gadget 片段
        if (part.startsWith('#')) {
          // 如果是未闭合的 gadget，则忽略
          if (!part.endsWith(';')) {
            return;
          }

          // 处理已闭合的gadget
          let gadgetName = part.slice(1, -1);
          if (!gadgetName) return;

          const allow00 = !gadgetName.startsWith('-');
          if (!allow00) {
            gadgetName = gadgetName.slice(1);
          }
          const hexValue = getGadgetHex(gadgetName, gadgets, allow00);

          if (hexValue) {
            hexChars += hexValue.toUpperCase();
            // 为gadget对应的每个十六进制字符创建映射
            for (let k = 0; k < hexValue.length; k++) {
              mapping.push({
                inputIndex: partStartPosInInput,
                lineIndex: lineIndex,
                charIndex: partStartIndexInLine,
              });
            }
          }
          // 如果在gadgets.json中未找到定义，则忽略该gadget
        } else if (!/^\s+$/.test(part)) {
          // 忽略纯空白部分
          // 处理普通代码（非gadget部分），提取十六进制字符
          for (let i = 0; i < part.length; i++) {
            const char = part[i];
            if (/[0-9A-Fa-f]/.test(char)) {
              hexChars += char.toUpperCase();
              // 为每个有效的十六进制字符创建精确的映射
              mapping.push({
                inputIndex: partStartPosInInput + i,
                lineIndex: lineIndex,
                charIndex: partStartIndexInLine + i,
              });
            }
          }
        }
      });

      // 更新位置，准备处理下一行 (+1 是为了换行符)
      currentPosInInput += line.length + 1;
    });

    return { hexChars, mapping };
  };

  // 当输入区变化时，更新Hex显示和字节映射
  useEffect(() => {
    // 从输入代码生成十六进制字符流和映射
    const { hexChars: rawHexChars, mapping: rawMapping } = parseInputToHex(
      input,
      gadgets
    );

    // 如果解析后没有任何十六进制内容，则提供一个默认的 "00" 字节用于显示
    const hexChars = rawHexChars.length > 0 ? rawHexChars : '00';
    const mapping =
      rawMapping.length > 0
        ? rawMapping
        : [
            { inputIndex: 0, lineIndex: 0, charIndex: 0 },
            { inputIndex: 0, lineIndex: 0, charIndex: 0 },
          ];

    // 将连续的十六进制字符流格式化为16字节宽的行
    const rows = []; // 存储最终在界面上显示的十六进制行
    const byteMapping = []; // 存储每个字节到原始输入位置的映射

    for (let i = 0; i < hexChars.length; i += 32) {
      // 32个字符 = 16字节
      const chunk = hexChars.slice(i, i + 32).padEnd(32, '0'); // 不足一行则用'0'补齐
      const bytes = [];
      const byteMappingRow = [];

      for (let j = 0; j < chunk.length; j += 2) {
        // 每2个字符为一个字节
        const byte = chunk.substring(j, j + 2);
        bytes.push(byte);

        // 为每个字节创建映射关系
        // 一个字节由两个十六进制字符组成，记录这两个字符在原始输入中的位置
        const firstCharIndex = i + j;
        const secondCharIndex = i + j + 1;

        const firstCharPos =
          firstCharIndex < mapping.length ? mapping[firstCharIndex] : null;
        const secondCharPos =
          secondCharIndex < mapping.length ? mapping[secondCharIndex] : null;

        byteMappingRow.push([firstCharPos, secondCharPos]);
      }

      rows.push(bytes);
      byteMapping.push(byteMappingRow);
    }

    onHexDisplayChange(rows, byteMapping);
  }, [input, onHexDisplayChange]);

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
          className={style.copyButton}
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
