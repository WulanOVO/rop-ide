export function parseRopInput(input, gadgets, options = {}) {
  const { leftStartAddress, rightStartAddress } = options;

  const lines = input.split('\n');
  const charPosInInputMap = [];
  const highlightLines = [];
  const constants = {};
  let hexChars = '';
  let posInInput = 0;

  const pushHexChars = (hex, startPosInLine, endPosInLine, repeatBytes) => {
    // 在写入 gadget 或数值块时，按需要补齐半字节对齐
    if (hex) {
      if (hexChars.length % 2 !== 0) {
        hexChars += '0';
      }

      hexChars += hex.toUpperCase();

      // 为每个生成的字节写入映射（每字节两个十六进制字符）
      for (let k = 0; k < repeatBytes; k++) {
        charPosInInputMap.push(startPosInLine);
        charPosInInputMap.push(endPosInLine);
      }
    }
  };

  lines.forEach((line) => {
    const lineStartPosInInput = posInInput;
    const spans = [];

    const pushSpan = (type, content) => {
      spans.push({ type, content });
    };

    let i = 0;
    while (i < line.length) {
      const char = line[i];
      const charPosInInput = lineStartPosInInput + i;

      // 注释 //...
      if (char === '/' && line[i + 1] === '/') {
        const commentContent = line.substring(i);
        pushSpan('comment', commentContent);
        break;
      }

      // 常量 $a = 0x...; 或 $a = ...;
      else if (char === '$') {
        let j = i + 1;
        while (j < line.length && line[j] !== ';') j++;

        const hasSemicolon = j < line.length && line[j] === ';';
        const constantContent = line.substring(i, hasSemicolon ? j + 1 : j);

        if (hasSemicolon) {
          const partsForHighlight = constantContent.split(/(\s*=\s*)/);
          if (partsForHighlight.length === 3) {
            pushSpan('constant,name', partsForHighlight[0]);
            pushSpan('constant,equal', partsForHighlight[1]);
            pushSpan(
              'constant,value',
              partsForHighlight[2].substring(0, partsForHighlight[2].length - 1)
            );
            pushSpan('', ';');
          } else {
            pushSpan('constant,name,warning', constantContent);
          }

          // 解析并记录常量值（用于后续 [ ... ] 求值）
          const constantStr = line.substring(i + 1, j).replace(/\s+/g, '');
          const parts = constantStr.split('=');
          if (parts.length === 2) {
            let constantValue = parseInt(parts[1], 16);
            if (!isNaN(constantValue)) {
              if (constantValue > 0xffff) constantValue &= 0xffff; // 截取低16位
              constants[parts[0]] = constantValue;
            }
          }
        } else {
          pushSpan('constant,name', constantContent);
        }

        i = j + (hasSemicolon ? 1 : 0);
      }

      // gadget #...;
      else if (char === '#') {
        let j = i + 1;
        while (j < line.length && line[j] !== ';' && line[j] !== ' ') j++;

        const hasSemicolon = j < line.length && line[j] === ';';
        const gadgetContent = line.substring(i, hasSemicolon ? j + 1 : j);

        if (hasSemicolon) {
          let gadgetName = gadgetContent.substring(1, gadgetContent.length - 1);
          const allow00 = !gadgetName.startsWith('-');
          if (!allow00) gadgetName = gadgetName.slice(1);

          const gadget = gadgets.find((g) => g.name === gadgetName);
          if (!gadget) {
            pushSpan('gadget,warning', gadgetContent);
          } else {
            pushSpan('gadget,closed', gadgetContent);

            // 计算 gadget 对应的 4 字节字节序
            const addr = gadget.addr || '';
            let hex = '';
            hex += addr.slice(3, 5);
            if (hex === '00' && !allow00) hex = '01';
            hex += addr.slice(1, 3);
            hex += `${allow00 ? '0' : '3'}${addr[0]}`;
            hex += allow00 ? '00' : '30';

            // 为 4 字节（8 个 hex 字符）建立两端范围映射
            pushHexChars(hex, charPosInInput, lineStartPosInInput + j, 4);
          }
        } else {
          pushSpan('gadget', gadgetContent);
        }

        i = j + (hasSemicolon ? 1 : 0);
      }

      // 数值块 [...]
      else if (char === '[') {
        let j = i + 1;
        while (j < line.length && line[j] !== ']') j++;

        const hasBracket = j < line.length && line[j] === ']';
        const valueContent = line.substring(i, hasBracket ? j + 1 : j);

        if (hasBracket) {
          const inner = line.substring(i + 1, j);

          let value = 0x0000;
          let symbol = '';
          let hasErrors = false;

          // 计算数值块的实际值
          const parts = inner.split(' ').filter(Boolean);
          for (const part of parts) {
            if (part.startsWith('$')) {
              const constantName = part.substring(1);
              const constantValue = constants[constantName];

              if (constantValue !== undefined) {
                if (symbol === '+') {
                  value += constantValue;
                } else if (symbol === '-') {
                  value -= constantValue;
                } else {
                  if (value === 0x0000) {
                    value = constantValue;
                  } else {
                    hasErrors = true;
                    break;
                  }
                }
              } else {
                hasErrors = true;
                break;
              }
            } else if (part === '+' || part === '-') {
              symbol = part;
            } else {
              if (symbol === '+') {
                value += parseInt(part, 16);
              } else if (symbol === '-') {
                value -= parseInt(part, 16);
              } else {
                if (value === 0x0000) {
                  value = parseInt(part, 16);
                } else {
                  hasErrors = true;
                  break;
                }
              }
              symbol = '';
            }
          }

          if (symbol !== '') {
            hasErrors = true;
          }

          if (!isNaN(value)) {
            if (value > 0xffff) value &= 0xffff; // 截取低16位
          } else {
            hasErrors = true;
          }

          if (hasErrors) {
            pushSpan('value,closed,warning', valueContent);
            i = j + 1;
            continue;
          } else {
            pushSpan('value,closed', valueContent);
          }

          const addrStr = value.toString(16).toUpperCase().padStart(4, '0');
          const littleEndian = addrStr.slice(2, 4) + addrStr.slice(0, 2);

          pushHexChars(
            littleEndian,
            charPosInInput,
            lineStartPosInInput + j,
            2
          );
        } else {
          pushSpan('value', valueContent);
        }

        i = j + (hasBracket ? 1 : 0);
      }

      // 地址锚点<-...> 或 <...>
      else if (char === '<') {
        let j = i + 1;
        while (j < line.length && line[j] !== '>' && line[j] !== ' ') j++;

        const hasClose = j < line.length && line[j] === '>';
        const anchorContent = line.substring(i, hasClose ? j + 1 : j);

        if (hasClose) {
          pushSpan('anchor,closed', anchorContent);

          // 记录锚点为常量（值依赖左右起始地址与当前字节流长度）
          let anchorName = line.substring(i + 1, j);
          let addrStart = parseInt(rightStartAddress || '0', 16);
          if (anchorName.startsWith('-')) {
            anchorName = anchorName.substring(1);
            addrStart = parseInt(leftStartAddress || '0', 16);
          }
          const addr = addrStart + Math.ceil(hexChars.length / 2);
          constants[anchorName] = addr;
        } else {
          pushSpan('anchor', anchorContent);
        }

        i = j + (hasClose ? 1 : 0);
      }

      // 十六进制字符和空白块
      else if (/[0-9a-fA-F]/.test(char)) {
        let j = i + 1;
        while (j < line.length && /[0-9a-fA-F\s]/.test(line[j])) j++;

        const hexContent = line.substring(i, j);
        pushSpan('hex', hexContent);

        // 仅将其中的十六进制字符写入 hex 流，并建立一一映射
        for (let t = i; t < j; t++) {
          const c = line[t];
          if (/[0-9a-fA-F]/.test(c)) {
            hexChars += c.toUpperCase();
            charPosInInputMap.push(lineStartPosInInput + t);
          }
        }

        i = j;
      }

      // 其他字符
      else {
        let j = i + 1;
        while (j < line.length && !/[0-9a-fA-F\s]/.test(line[j])) j++;
        const otherContent = line.substring(i, j);
        pushSpan('other', otherContent);
        i = j;
      }
    }

    highlightLines.push(spans);
    posInInput += line.length + 1; // +1 换行符
  });

  return { hexChars, charPosInInputMap, highlightLines };
}
