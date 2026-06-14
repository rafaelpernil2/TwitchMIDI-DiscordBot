const LATEX_TO_UNICODE: Record<string, string> = {
  rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐',
  leftrightarrow: '↔', uparrow: '↑', downarrow: '↓',
  times: '×', div: '÷', pm: '±', cdot: '·',
  leq: '≤', geq: '≥', neq: '≠', approx: '≈', infty: '∞',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε',
  theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ',
  tau: 'τ', phi: 'φ', omega: 'ω',
};

export function sanitizeForDiscord(text: string): string {
  return text
    .replace(/\$\\(\w+)\$/g, (_, cmd) => LATEX_TO_UNICODE[cmd] ?? cmd)
    .replace(/\$\$([^$]+)\$\$/gs, '$1')
    .replace(/\$([^$\n]+)\$/g, '$1');
}
