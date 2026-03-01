export function parseRopInput(input, gadgets, options = {}) {
  const { leftStartAddress, rightStartAddress } = options;

  const lines = input.split('\n');
  const charPosInInputMap = [];
  const highlightLines = [];
  const constants = {};
  let errorCount = 0;
  let hexChars = '';
  let posInInput = 0;

  // 记录需要在解析结束后回填的数值块（用于支持前向引用常量/锚点）
  const deferredValuePatches = [];
  const deferredHighlightPatches = [];

  // 二次求值函数：根据最终 constants 计算表达式值
  const evalExpression = (
    inner,
    constants,
    allowUndefinedAsDeferred = false
  ) => {
    let value = 0x0000;
    let symbol = '+';
    let hasErrors = false;
    let deferred = false;

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
            hasErrors = true;
            break;
          }
        } else {
          if (allowUndefinedAsDeferred) {
            deferred = true;
            if (symbol === '+') {
              value += 0;
            } else if (symbol === '-') {
              value -= 0;
            } else {
              hasErrors = true;
              break;
            }
          } else {
            hasErrors = true;
            break;
          }
        }

        symbol = '';
      } else if (part === '+' || part === '-') {
        if (symbol === '') {
          symbol = part;
        } else {
          hasErrors = true;
          break;
        }
      } else {
        if (!/^-?[0-9a-fA-F]+$/.test(part)) {
          hasErrors = true;
          break;
        }

        if (symbol === '+') {
          value += parseInt(part, 16);
        } else if (symbol === '-') {
          value -= parseInt(part, 16);
        } else {
          hasErrors = true;
          break;
        }
        symbol = '';
      }
    }

    if (symbol !== '') {
      hasErrors = true;
    } else if (!isNaN(value)) {
      if (
        !(allowUndefinedAsDeferred && deferred) &&
        (value > 0xffff || value < -0x8000)
      ) {
        hasErrors = true;
      }
      if (value < 0) {
        value = 0xffff + value + 1; // 负值处理
      }
    } else {
      hasErrors = true;
    }

    return { value, hasErrors, deferred };
  };

  const pushHexChars = (hex, startPosInLine, endPosInLine, repeatBytes) => {
    if (!hex) return;

    hexChars += hex.toUpperCase();

    // 为每个生成的字节写入映射（每字节两个十六进制字符）
    for (let k = 0; k < repeatBytes; k++) {
      charPosInInputMap.push(startPosInLine);
      charPosInInputMap.push(endPosInLine);
    }
  };

  lines.forEach((line, lineIndex) => {
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
          const constantStr = line.substring(i + 1, j).replace(/\s+/g, '');
          const parts = constantStr.split('=');

          if (parts.length === 2) {
            let intValue = parseInt(parts[1], 16);

            if (
              /^-?[0-9a-fA-F]+$/.test(parts[1]) &&
              !isNaN(intValue) &&
              intValue <= 0xffff &&
              intValue >= -0x8000
            ) {
              if (intValue > 0xffff) {
                intValue &= 0xffff; // 截取低16位
              }
            } else {
              errorCount++;
              pushSpan('constant,value,warning', constantContent);
              i = j + 1;
              continue;
            }

            if (constants[parts[0]] !== undefined) {
              errorCount++;
              pushSpan('constant,name,warning', constantContent);
              i = j + 1;
              continue;
            }

            constants[parts[0]] = intValue;
          }

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
            errorCount++;
            pushSpan('constant,name,warning', constantContent);
          }
        } else {
          errorCount++;
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
            errorCount++;
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
          const firstPass = evalExpression(inner, constants, true);
          let value = firstPass.value;
          let hasErrors = firstPass.hasErrors;
          let deferred = firstPass.deferred || /\$/.test(inner);

          if (hasErrors) {
            pushSpan('value,closed,warning', valueContent);
            i = j + 1;
            continue;
          } else {
            pushSpan('value,closed', valueContent);
          }

          const addrStr = value.toString(16).toUpperCase().padStart(4, '0');
          const littleEndian = addrStr.slice(2, 4) + addrStr.slice(0, 2);

          if (!deferred) {
            pushHexChars(
              littleEndian,
              charPosInInput,
              lineStartPosInInput + j,
              2
            );
          } else {
            deferredValuePatches.push({
              startHexIndex: hexChars.length,
              endHexIndex: hexChars.length,
              expression: inner,
              startPosInLine: charPosInInput,
              endPosInLine: lineStartPosInInput + j,
              bytesToInsert: 2,
            });
            deferredHighlightPatches.push({
              lineIndex,
              spanIndex: spans.length - 1,
              expression: inner,
            });
          }
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
          let deferredBytesBeforeAnchor = 0;
          for (const p of deferredValuePatches) {
            if (p.startHexIndex <= hexChars.length) {
              deferredBytesBeforeAnchor += p.bytesToInsert || 2;
            }
          }
          const addr =
            addrStart +
            Math.ceil(hexChars.length / 2) +
            deferredBytesBeforeAnchor;
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

        let hexContent = line.substring(i, j);
        pushSpan('hex', hexContent);

        for (let k = i; k < j; k++) {
          const c = line[k];
          if (/[0-9a-fA-F]/.test(c)) {
            hexChars += c.toUpperCase();
            charPosInInputMap.push(lineStartPosInInput + k);
          }
        }

        i = j;
      }

      // 其他字符
      else {
        let j = i + 1;
        while (j < line.length && !/[0-9a-fA-F\/\$#\[<]/.test(line[j])) j++;
        const otherContent = line.substring(i, j);
        pushSpan('other', otherContent);
        i = j;
      }
    }

    highlightLines.push(spans);
    posInInput += line.length + 1; // +1 换行符
  });

  // 二次阶段：按位置顺序插入延迟字节，保证顺序稳定
  {
    let insertedHexCount = 0;
    const patchesSorted = deferredValuePatches
      .slice()
      .sort((a, b) => a.startHexIndex - b.startHexIndex);
    for (const patch of patchesSorted) {
      const { value, hasErrors } = evalExpression(
        patch.expression,
        constants,
        false
      );
      if (hasErrors) {
        errorCount++;
        continue;
      }
      const addrStr = value.toString(16).toUpperCase().padStart(4, '0');
      const littleEndian = addrStr.slice(2, 4) + addrStr.slice(0, 2);
      const insertPos = patch.startHexIndex + insertedHexCount;

      hexChars =
        hexChars.substring(0, insertPos) +
        littleEndian +
        hexChars.substring(insertPos);

      insertedHexCount += littleEndian.length;

      if (Array.isArray(charPosInInputMap)) {
        const mapping = [];
        for (let k = 0; k < (patch.bytesToInsert || 2); k++) {
          mapping.push(patch.startPosInLine);
          mapping.push(patch.endPosInLine);
        }
        charPosInInputMap.splice(insertPos, 0, ...mapping);
      }
    }
  }

  for (const h of deferredHighlightPatches) {
    const { hasErrors } = evalExpression(h.expression, constants, false);
    if (hasErrors) {
      const span = highlightLines[h.lineIndex]?.[h.spanIndex];
      if (span) {
        span.type = span.type.includes('warning')
          ? span.type
          : `${span.type},warning`;
      }
    }
  }

  return { hexChars, charPosInInputMap, highlightLines, errorCount };
}
