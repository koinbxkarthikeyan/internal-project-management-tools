/**
 * A small syntax highlighter for the code messages: it splits code into comments, strings, numbers, keywords and plain text for the languages the chat offers. It only reads text and
 * returns pieces to colour; nothing in the code is ever run or treated as markup.
 */
export type Piece = { text: string; kind?: "comment" | "string" | "number" | "keyword" | "tag" };

const WORDS = (s: string) => new Set(s.split(" "));
const JS = "const let var function return if else for while do switch case break continue new class extends import export from default async await try catch finally throw typeof instanceof in of this super yield static null undefined true false void delete";
const KEYWORDS: Record<string, Set<string>> = {
  javascript: WORDS(JS),
  typescript: WORDS(`${JS} interface type enum implements public private protected readonly abstract as is keyof declare namespace`),
  python: WORDS("def class return if elif else for while in not and or is import from as try except finally raise with lambda pass break continue yield None True False async await global nonlocal"),
  java: WORDS("public private protected class interface extends implements static final void int long double float boolean char byte short new return if else for while do switch case break continue try catch finally throw throws import package this super null true false abstract enum instanceof"),
  sql: WORDS("select from where and or not insert into values update set delete create table drop alter add index join left right inner outer on group by order having limit offset as distinct null is in like between union all case when then else end primary key foreign references default"),
  bash: WORDS("if then else elif fi for while do done case esac function in echo exit return export local read cd ls grep sudo set unset source true false"),
  php: WORDS("function class public private protected static return if else elseif for foreach while do switch case break continue new try catch finally throw namespace use echo null true false array as extends implements interface abstract const"),
  c: WORDS("int char float double void long short unsigned signed struct union enum typedef static const extern return if else for while do switch case break continue sizeof goto include define NULL"),
  cpp: WORDS("int char float double void long short unsigned signed struct union enum typedef static const extern return if else for while do switch case break continue sizeof class public private protected virtual namespace using template typename new delete try catch throw include define nullptr true false auto bool"),
  css: WORDS("important"),
  scss: WORDS("important mixin include extend function return if else each for while use forward"),
  json: WORDS("true false null"),
  html: WORDS(""),
};
const LINE_COMMENT: Record<string, string> = { javascript: "//", typescript: "//", java: "//", php: "//", c: "//", cpp: "//", scss: "//", python: "#", bash: "#", sql: "--" };
const BLOCK_COMMENT = new Set(["javascript", "typescript", "java", "php", "c", "cpp", "css", "scss", "sql"]);

export function highlight(code: string, lang: string): Piece[] {
  const out: Piece[] = [];
  const keywords = KEYWORDS[lang] ?? new Set<string>();
  const sqlLike = lang === "sql";
  const line = LINE_COMMENT[lang];
  let plain = "";
  const flush = () => {
    if (plain) out.push({ text: plain });
    plain = "";
  };
  const push = (text: string, kind: Piece["kind"]) => {
    flush();
    out.push({ text, kind });
  };
  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);
    if (lang === "html" && rest.startsWith("<!--")) {
      const end = code.indexOf("-->", i + 4);
      const stop = end < 0 ? code.length : end + 3;
      push(code.slice(i, stop), "comment");
      i = stop;
    } else if (lang === "html" && rest[0] === "<") {
      const end = code.indexOf(">", i);
      const stop = end < 0 ? code.length : end + 1;
      push(code.slice(i, stop), "tag");
      i = stop;
    } else if (BLOCK_COMMENT.has(lang) && rest.startsWith("/*")) {
      const end = code.indexOf("*/", i + 2);
      const stop = end < 0 ? code.length : end + 2;
      push(code.slice(i, stop), "comment");
      i = stop;
    } else if (line && rest.startsWith(line)) {
      const end = code.indexOf("\n", i);
      const stop = end < 0 ? code.length : end;
      push(code.slice(i, stop), "comment");
      i = stop;
    } else if (rest[0] === '"' || rest[0] === "'" || (rest[0] === "`" && lang !== "sql")) {
      const q = rest[0];
      let j = i + 1;
      while (j < code.length && code[j] !== q && code[j] !== "\n") j += code[j] === "\\" ? 2 : 1;
      const stop = Math.min(code.length, code[j] === q ? j + 1 : j);
      push(code.slice(i, stop), "string");
      i = stop;
    } else if (/[0-9]/.test(rest[0]) && !/[\w$]/.test(code[i - 1] ?? "")) {
      const m = /^(0x[0-9a-f]+|\d+(\.\d+)?)/i.exec(rest)!;
      push(m[0], "number");
      i += m[0].length;
    } else if (/[A-Za-z_$]/.test(rest[0])) {
      const m = /^[A-Za-z_$][\w$]*/.exec(rest)![0];
      const word = sqlLike ? m.toLowerCase() : m;
      if (keywords.has(word)) push(m, "keyword");
      else plain += m;
      i += m.length;
    } else {
      plain += rest[0];
      i += 1;
    }
  }
  flush();
  return out;
}
