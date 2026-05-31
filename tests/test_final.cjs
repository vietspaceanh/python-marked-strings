const { OnigScanner, OnigString } = require('vscode-oniguruma');
const { Registry, INITIAL } = require('vscode-textmate');
const fs = require('fs');
const path = require('path');

async function main() {
  await require('vscode-oniguruma').loadWASM(
    fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer
  );

  const reg = new Registry({
    onigLib: Promise.resolve({ createOnigScanner: (s) => new OnigScanner(s), createOnigString: (s) => new OnigString(s) }),
    getInjections: (s) => s === 'source.python' ? ['injection.marked-strings.python'] : [],
    loadGrammar: async (s) => {
      const m = {
        'source.python': 'grammars/MagicPython.tmLanguage.json',
        'text.html.markdown.no-indent': '../syntaxes/markdown-no-indent.tmLanguage.json',
        'text.html.basic': 'grammars/html.tmLanguage.json',
        'source.sql': 'grammars/sql.tmLanguage.json',
        'injection.marked-strings.python': '../syntaxes/lang-in-python.tmLanguage.json',
      };
      return m[s] ? JSON.parse(fs.readFileSync(path.join(__dirname, m[s]), 'utf8')) : null;
    }
  });

  const g = await reg.loadGrammar('source.python');
  const testFile = path.join(__dirname, 'test_real.py');
  const code = fs.readFileSync(testFile, 'utf8');
  const lines = code.split('\n');

  console.log('=== Tokenizing', testFile, '===\n');

  let stack = INITIAL;
  for (let n = 0; n < lines.length; n++) {
    const r = g.tokenizeLine(lines[n], stack);
    stack = r.ruleStack;
    for (const t of r.tokens) {
      const text = lines[n].substring(t.startIndex, t.endIndex);
      if (!text.trim()) continue;
      const scopes = t.scopes.join(' > ');
      const isEmbedded =
        scopes.includes('embedded.block.markdown') ||
        scopes.includes('embedded.block.html') ||
        scopes.includes('embedded.block.sql');
      const hasString = scopes.includes('string.quoted.multi') || scopes.includes('string.quoted.docstring');
      if (isEmbedded || hasString || text.includes('"""') || text.includes('def ') || text.includes('sql(')) {
        const label = hasString ? 'STRING' : isEmbedded ? 'EMBED' : 'OTHER';
        console.log(`  L${n} ${label.padEnd(6)} "${text}"  ${scopes}`);
      }
    }
  }

  // Verify functions after each block are clean
  const checks = ['after_md', 'after_html', 'after_sql', 'after_query_dash', 'after_all', 'after_el'];
  stack = INITIAL;
  for (let n = 0; n < lines.length; n++) {
    const r = g.tokenizeLine(lines[n], stack);
    stack = r.ruleStack;
    for (const t of r.tokens) {
      const text = lines[n].substring(t.startIndex, t.endIndex);
      if (checks.includes(text)) {
        const inEmbed = t.scopes.some(s =>
          s.includes('embedded.block.markdown') ||
          s.includes('embedded.block.html') ||
          s.includes('embedded.block.sql')
        );
        const status = inEmbed ? '❌ FAIL' : '✓ PASS';
        console.log(`\n  → ${text} in embedded scope: ${inEmbed} ${status}`);
      }
    }
  }
}

main().catch(console.error);
