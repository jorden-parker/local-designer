const CLOSED_FENCE = /```[\w-]*\n([\s\S]*?)```/g;
const OPEN_FENCE = /```[\w-]*\n([\s\S]*)$/;

function longest(blocks: string[]): string {
  return blocks.reduce((best, block) => (block.length > best.length ? block : best), "");
}

export function extractCode(reply: string): string {
  const blocks = [...reply.matchAll(CLOSED_FENCE)].map((match) => match[1]);
  if (blocks.length > 0) return longest(blocks).trim();
  return (reply.match(OPEN_FENCE)?.[1] ?? reply).trim();
}
