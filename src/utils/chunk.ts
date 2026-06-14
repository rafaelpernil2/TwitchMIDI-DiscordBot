export function chunkMessage(text: string, maxLength: number = 2000): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    if (text.length - currentIndex <= maxLength) {
      chunks.push(text.slice(currentIndex));
      break;
    }

    // Try to find a good breaking point (newline)
    let breakPoint = text.lastIndexOf('\n', currentIndex + maxLength);
    if (breakPoint <= currentIndex) {
      // If no newline, break at a space
      breakPoint = text.lastIndexOf(' ', currentIndex + maxLength);
      if (breakPoint <= currentIndex) {
        // If no space, force break
        breakPoint = currentIndex + maxLength;
      }
    }

    chunks.push(text.slice(currentIndex, breakPoint));
    currentIndex = breakPoint + (text[breakPoint] === '\n' || text[breakPoint] === ' ' ? 1 : 0);
  }

  return chunks;
}
