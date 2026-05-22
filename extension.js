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
}

function deactivate() {}

module.exports = { activate, deactivate };
