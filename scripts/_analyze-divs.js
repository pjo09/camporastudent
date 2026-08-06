const fs = require("fs");
const html = fs.readFileSync("frontend/add-property.html", "utf8");
const lines = html.split(/\r?\n/);

const stack = [];
let mismatches = 0;

const openRe = /<div\b[^>]*>/gi;
const closeRe = /<\/div\b[^>]*>/gi;

// Build a stream of tokens with line numbers
const tokens = [];
lines.forEach((line, idx) => {
  let m;
  const re = /<\/?div\b[^>]*>/gi;
  while ((m = re.exec(line)) !== null) {
    tokens.push({ tag: m[0], line: idx + 1, text: line.trim() });
  }
});

tokens.forEach((t) => {
  if (t.tag.startsWith("</")) {
    if (stack.length === 0) {
      console.log("EXTRA CLOSE @line " + t.line + ": " + t.text);
      mismatches++;
    } else {
      stack.pop();
    }
  } else {
    stack.push(t);
  }
});

console.log("UNCLOSED DIV COUNT: " + stack.length);
stack.forEach((s) => {
  console.log("  open@line" + s.line + ": " + s.text.slice(0, 150));
});
console.log("MISMATCHES: " + mismatches);

