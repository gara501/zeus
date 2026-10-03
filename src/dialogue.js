// Fit complete words into at most two rendered lines without losing narration.
export function dialoguePage(words, start, width, measure) {
  const lines = [''];
  let end = start;
  while (end < words.length) {
    const line = lines.length - 1;
    const candidate = lines[line] ? `${lines[line]} ${words[end]}` : words[end];
    if (measure(candidate) <= width || !lines[line]) {
      lines[line] = candidate;
      end++;
    } else if (lines.length === 1) lines.push('');
    else break;
  }
  return { text: lines.join(' '), end };
}
