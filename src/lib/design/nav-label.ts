const LABEL_WORDS = 2;

function subject(name: string): string {
  return (name.split(":").at(-1) ?? name)
    .trim()
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/\s*(\bpage\b|\bwith\b|,).*$/i, "");
}

export function navLabel(name: string): string {
  const words = subject(name).split(/\s+/).filter(Boolean).slice(0, LABEL_WORDS).join(" ");
  return words ? words[0].toUpperCase() + words.slice(1) : name;
}
