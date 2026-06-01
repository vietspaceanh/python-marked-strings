const { OnigScanner, OnigString } = require('vscode-oniguruma');
const { Registry, INITIAL } = require('vscode-textmate');
const fs = require('fs');
const path = require('path');

async function main() {
  await require('vscode-oniguruma').loadWASM(
    fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer
  );

  const registry = new Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (sources) => new OnigScanner(sources),
      createOnigString: (str) => new OnigString(str),
    }),
    getInjections: (scopeName) => {
      if (scopeName === 'source.python') return ['injection.marked-strings.python'];
      return [];
    },
    loadGrammar: async (scopeName) => {
      const files = {
        'source.python': 'grammars/MagicPython.tmLanguage.json',
        'text.html.markdown.no-indent': '../syntaxes/markdown-no-indent.tmLanguage.json',
        'text.html.basic': 'grammars/html.tmLanguage.json',
        'source.sql': 'grammars/sql.tmLanguage.json',
        'injection.marked-strings.python': '../syntaxes/lang-in-python.tmLanguage.json',
      };
      const p = files[scopeName];
      if (!p) return null;
      return JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));
    }
  });

  const grammar = await registry.loadGrammar('source.python');

  const tests = [
    {
      name: 'HTML comment in markdown string — comment.block.html scope',
      code: `def test():
    return """md
    text before <!-- this is a comment --> text after
    """`,
      check: (tokens) => {
        let hasComment = false;
        for (const t of tokens)
          if (t.scopes.some(s => s === 'comment.block.html'))
            hasComment = true;
        return hasComment;
      }
    },
    {
      name: 'HTML comment in html string — comment.block.html scope',
      code: `def test():
    return """html
    <div><!-- comment --></div>
    """`,
      check: (tokens) => {
        let hasComment = false;
        for (const t of tokens)
          if (t.scopes.some(s => s === 'comment.block.html'))
            hasComment = true;
        return hasComment;
      }
    },

    {
      name: 'Simple md string — check no string scope in content',
      code: `def test():
    return """md
    # Heading
    - list
    **bold**
    """`,
      check: (tokens) => {
        let hasMarkdown = false;
        let hasStringOnMarkdown = false;
        for (const t of tokens) {
          const isMarkdown = t.scopes.some(s => s.includes('heading') || s.includes('list') || s.includes('bold'));
          if (isMarkdown) {
            hasMarkdown = true;
            if (t.scopes.some(s => s.includes('string.quoted.multi')))
              hasStringOnMarkdown = true;
          }
        }
        return hasMarkdown && !hasStringOnMarkdown;
      }
    },
    {
      name: 'f-string md with nested sql(f""")',
      code: `def test():
    return f"""md
    # Test
    - item
    {
        sql(f"""
            select 1
        """)
    }
    """

def test2():
    pass`,
      check: (tokens) => {
        let afterMdOk = false;
        for (const t of tokens) {
          if (t.line.startsWith('def test2')) afterMdOk = !t.scopes.some(s => s.includes('embedded.block.markdown'));
        }
        return afterMdOk;
      }
    },
    {
      name: 'el("""md...""") — content gets markdown scopes not string',
      code: `some_code = el("""md
    # Heading
    - list
    **bold**
    """)`,
      check: (tokens) => {
        let hasMarkdown = false;
        let hasStringOnMarkdown = false;
        for (const t of tokens) {
          const isMarkdown = t.scopes.some(s => s.includes('heading') || s.includes('list') || s.includes('bold'));
          if (isMarkdown) {
            hasMarkdown = true;
            if (t.scopes.some(s => s.includes('string.quoted.multi')))
              hasStringOnMarkdown = true;
          }
        }
        return hasMarkdown && !hasStringOnMarkdown;
      }
    },
    {
      name: "return '''md — markdown with single-quote triple quotes",
      code: `def test():
    return '''md
    # Heading
    - list
    **bold**
    '''`,
      check: (tokens) => {
        let hasMarkdown = false;
        let hasStringOnMarkdown = false;
        for (const t of tokens) {
          const isMarkdown = t.scopes.some(s => s.includes('heading') || s.includes('list') || s.includes('bold'));
          if (isMarkdown) {
            hasMarkdown = true;
            if (t.scopes.some(s => s.includes('string.quoted.multi')))
              hasStringOnMarkdown = true;
          }
        }
        return hasMarkdown && !hasStringOnMarkdown;
      }
    },
    {
      name: "el('''md...''') — content gets markdown scopes not string",
      code: `some_code = el('''md
    # Heading
    - list
    **bold**
    ''')`,
      check: (tokens) => {
        let hasMarkdown = false;
        let hasStringOnMarkdown = false;
        for (const t of tokens) {
          const isMarkdown = t.scopes.some(s => s.includes('heading') || s.includes('list') || s.includes('bold'));
          if (isMarkdown) {
            hasMarkdown = true;
            if (t.scopes.some(s => s.includes('string.quoted.multi')))
              hasStringOnMarkdown = true;
          }
        }
        return hasMarkdown && !hasStringOnMarkdown;
      }
    },
    {
      name: "return '''md with nested f\"\"\"--sql — single-quote markdown containing double-quote SQL",
      code: `def test():
    return '''md
    \`stg_customers\`: their \`id\`.

    {
        sql(f"""
            from stg_customers
            limit 5
        """)
    }
    '''`,
      check: (tokens) => {
        let hasMarkdown = false;
        let hasStringOnMarkdown = false;
        for (const t of tokens) {
          const isMarkdown = t.scopes.some(s => s.includes('embedded.block.markdown'));
          if (isMarkdown) {
            hasMarkdown = true;
          }
          const isEmbedded = t.scopes.some(s => s.includes('embedded.block.sql'));
          if (isEmbedded && t.scopes.some(s => s.includes('string.quoted.multi'))) {
            hasStringOnMarkdown = true;
          }
        }
        return hasMarkdown;
      }
    },
    {
      name: 'x = """md — content HAS string scope (no return keyword)',
      code: `x = """md
    ## 1. Existing building blocks
    - **Pandoc bindings** (e.g., \`pypandoc\`)
    """`,
      check: (tokens) => {
        for (const t of tokens)
          if (t.line.includes('Existing building blocks') || t.line.includes('Pandoc bindings'))
            if (t.scopes.some(s => s.includes('string.quoted.multi')))
              return true;
        return false;
      }
    },
  ];

  for (const test of tests) {
    console.log(`\n=== ${test.name} ===`);
    console.log(test.code);
    
    const lines = test.code.split('\n');
    let ruleStack = INITIAL;
    const allTokens = [];
    
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n];
      if (line === undefined) continue;
      const r = grammar.tokenizeLine(line, ruleStack);
      ruleStack = r.ruleStack;
      r.tokens.forEach(t => allTokens.push({
        line: line, text: line.substring(t.startIndex, t.endIndex),
        lineNum: n, start: t.startIndex, end: t.endIndex,
        scopes: t.scopes,
      }));
    }

    // Print key scopes
    for (const t of allTokens) {
      if (!t.text.trim()) continue;
      const hasMarkdown = t.scopes.some(s => s.includes('heading') || s.includes('list') || s.includes('bold') || s.includes('inline.raw'));
      const hasString = t.scopes.some(s => s.includes('string.quoted.multi'));
      const isEndDelim = t.text === '"""';
      if (hasMarkdown || hasString || isEndDelim) {
        const color = hasString ? 'GREEN' : (hasMarkdown ? 'MARKDOWN' : 'OTHER');
        console.log(`  L${t.lineNum} [${t.start}-${t.end}] "${t.text}" → ${color}  ${t.scopes.join(' > ')}`);
      }
    }

    const ok = test.check(allTokens);
    console.log(`  → ${ok ? '✓ PASS' : '✗ FAIL'}`);
  }
}

main().catch(console.error);
