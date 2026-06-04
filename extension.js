const vscode = require('vscode');

const SQL_KEYWORDS = [
'SELECT', 'SELECT DISTINCT', 'FROM', 'WHERE', 'AND', 'OR',
'NOT', 'IN', 'NOT IN',
'EXISTS',
'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW',
'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL', 'OUTER', 'CROSS', 'ON', 'USING',
'GROUP BY', 'GROUP BY ALL', 'ORDER BY', 'ORDER BY ALL', 'HAVING', 'LIMIT', 'OFFSET', 'QUALIFY',
'DISTINCT', 'AS', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'IS NULL', 'IS NOT NULL',
'ASC', 'DESC', 'UNION', 'ALL', 'UNION BY NAME', 'CASE WHEN', 'THEN', 'ELSE', 'END',
'WITH', 'RECURSIVE',
'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
'COALESCE', 'NULLIF', 'CAST',
'CONCAT', 'UPPER', 'LOWER', 'TRIM', 'LENGTH', 'SUBSTRING',
'NOW', 'CURRENT_TIMESTAMP', 'CURRENT_DATE',
'INT', 'INTEGER', 'BIGINT', 'SMALLINT',
'VARCHAR', 'CHAR', 'TEXT', 'BOOLEAN',
'DECIMAL', 'FLOAT', 'DOUBLE',
'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'NOT NULL',
'DEFAULT', 'CHECK', 'CASCADE',
'EXPLAIN', 'ANALYZE',
'TRUNCATE', 'MERGE',
'BEGIN', 'COMMIT', 'ROLLBACK',
'ROW', 'ROWS', 'RANGE',
'ANY', 'SOME',
'INTERSECT', 'EXCEPT',
'TEMPORARY', 'TEMP',
'SERIAL', 'AUTO_INCREMENT',
'ENUM', 'JSON', 'JSONB', 'UUID',
'MATERIALIZED',
'FILTER', 'OVER', 'PARTITION BY',
'LATERAL',
'RETURNING',
'REPLACE',
'INTERVAL', 'TIMESTAMP', 'DATE',
'PIVOT', 'UNPIVOT',
];

function isInSqlRegion(doc, pos) {
  for (let i = pos.line; i >= 0; i--) {
    const text = doc.lineAt(i).text;
    const check = i === pos.line ? text.substring(0, pos.character) : text;
    if (/"""sql|"""--sql|'''sql|'''--sql|\b(sql|plot)\s*\(\s*['"]/.test(check)) return true;
    if (/\b(sql|plot)\s*\(/.test(check) && !/\)/.test(check)) return true;
    if (i !== pos.line && /^\s*("""|''')/.test(text) && !text.includes('sql')) break;
  }
  return false;
}

const MARKERS = ['md', 'sql', 'html', '--sql'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findClose(document, startLine, quoteStyle, funcCall) {
  const escaped = escapeRegex(quoteStyle);
  const markerPattern = new RegExp(escaped + '\\s*(' + MARKERS.join('|') + ')\\b');
  const funcOpenPattern = new RegExp('\\b(sql|plot|el)\\s*\\(\\s*[rRuUbBfF]*' + escaped);
  const closeAtEnd = new RegExp(escaped + '\\s*$');
  const closeOnOwnLine = new RegExp('^\\s*' + escaped + '\\s*$');
  const closeFuncCall = new RegExp(escaped + '\\s*\\)');

  for (let line = startLine; line < document.lineCount; line++) {
    const text = document.lineAt(line).text;
    if (markerPattern.test(text)) continue;
    if (funcOpenPattern.test(text)) continue;
    if (funcCall) {
      if (closeFuncCall.test(text)) return line;
    }
    if (closeOnOwnLine.test(text)) return line;
    if (closeAtEnd.test(text)) return line;
  }
  return -1;
}

function tryOpenMarkedString(text, line, document) {
  const m3 = text.match(new RegExp('\\b(el)\\s*\\(\\s*("""|\'\'\')\\s*(' + MARKERS.join('|') + ')\\b'));
  if (m3) {
    const closeLine = findClose(document, line + 1, m3[2], true);
    if (closeLine > line) {
      return { openLine: line, closeLine, markerType: m3[3] };
    }
  }

  const m2 = text.match(/\b(sql|plot)\s*\(\s*("""|''')/);
  if (m2) {
    const closeLine = findClose(document, line + 1, m2[2], true);
    if (closeLine > line) {
      return { openLine: line, closeLine, markerType: 'sql' };
    }
  }

  const m1 = text.match(new RegExp('("""|\'\'\')\\s*(' + MARKERS.join('|') + ')\\b'));
  if (m1) {
    const closeLine = findClose(document, line + 1, m1[1], false);
    if (closeLine > line) {
      return { openLine: line, closeLine, markerType: m1[2] };
    }
  }

  return null;
}

function findCodeFenceFolds(document, startLine, endLine) {
  const ranges = [];
  let line = startLine;
  while (line <= endLine) {
    const text = document.lineAt(line).text;
    const fenceMatch = text.match(/^\s*(```+)\s*(.*)$/);
    if (fenceMatch) {
      const fenceLen = fenceMatch[1].length;
      const closePattern = new RegExp('^\\s*`{' + fenceLen + ',}\\s*$');
      let closeLine = -1;
      for (let j = line + 1; j <= endLine; j++) {
        if (closePattern.test(document.lineAt(j).text)) {
          closeLine = j;
          break;
        }
      }
      if (closeLine >= line + 2) {
        ranges.push(new vscode.FoldingRange(line, closeLine, vscode.FoldingRangeKind.Region));
      }
      line = closeLine >= 0 ? closeLine : line;
    }
    line++;
  }
  return ranges;
}

function findHeaderFolds(document, startLine, endLine) {
  const headers = [];
  for (let i = startLine; i <= endLine; i++) {
    const match = document.lineAt(i).text.match(/^\s*(#{1,6})\s/);
    if (match) {
      headers.push({ line: i, level: match[1].length });
    }
  }

  const ranges = [];
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    let foldEnd = endLine;
    for (let j = i + 1; j < headers.length; j++) {
      if (headers[j].level <= header.level) {
        foldEnd = headers[j].line - 1;
        break;
      }
    }
    if (foldEnd > header.line) {
      ranges.push(new vscode.FoldingRange(header.line, foldEnd, vscode.FoldingRangeKind.Region));
    }
  }
  return ranges;
}

function findIndentationFolds(document, startLine, endLine) {
  const ranges = [];
  if (startLine >= endLine) return ranges;

  const indents = [];
  for (let i = startLine; i <= endLine; i++) {
    const text = document.lineAt(i).text;
    indents.push(text.trim() === '' ? -1 : text.search(/\S/));
  }

  let baseIndent = -1;
  for (const level of indents) {
    if (level >= 0) { baseIndent = level; break; }
  }
  if (baseIndent < 0) return ranges;

  const MIN_FOLD_LINES = 2;
  let i = 0;
  while (i < indents.length) {
    if (indents[i] > baseIndent) {
      const blockStart = i;
      const blockIndent = indents[i];
      let j = i + 1;
      while (j < indents.length) {
        if (indents[j] >= 0 && indents[j] <= blockIndent) break;
        j++;
      }
      const blockEnd = j - 1;
      if (blockEnd - blockStart >= MIN_FOLD_LINES) {
        ranges.push(new vscode.FoldingRange(
          startLine + blockStart, startLine + blockEnd, vscode.FoldingRangeKind.Region
        ));
      }
      i = j;
    } else {
      i++;
    }
  }
  return ranges;
}

function provideFoldingRanges(document) {
  const ranges = [];
  const lineCount = document.lineCount;
  let line = 0;

  while (line < lineCount) {
    const text = document.lineAt(line).text;
    const region = tryOpenMarkedString(text, line, document);

    if (region) {
      if (region.closeLine - region.openLine >= 2) {
        ranges.push(new vscode.FoldingRange(
          region.openLine, region.closeLine, vscode.FoldingRangeKind.Region
        ));
      }

      const contentStart = region.openLine + 1;
      const contentEnd = region.closeLine - 1;

      if (region.markerType === 'md' && contentStart <= contentEnd) {
        const fenceRanges = findCodeFenceFolds(document, contentStart, contentEnd);
        ranges.push(...fenceRanges);
        const headerRanges = findHeaderFolds(document, contentStart, contentEnd);
        ranges.push(...headerRanges);
      }

      if (contentStart <= contentEnd) {
        const indentRanges = findIndentationFolds(document, contentStart, contentEnd);
        ranges.push(...indentRanges);
      }

      line = region.closeLine + 1;
    } else {
      line++;
    }
  }

  const docIndentFolds = findIndentationFolds(document, 0, lineCount - 1);
  ranges.push(...docIndentFolds);

  return ranges;
}

function activate(context) {
  const provider = vscode.languages.registerCompletionItemProvider(
    { language: 'python', scheme: 'file' },
    {
      provideCompletionItems(document, position) {
        if (!isInSqlRegion(document, position)) return;

        return SQL_KEYWORDS.map(keyword => {
          const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
          item.insertText = keyword;
          return item;
        });
      }
    },
    ' '
  );

  context.subscriptions.push(provider);

  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      { language: 'python', scheme: 'file' },
      { provideFoldingRanges }
    )
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
