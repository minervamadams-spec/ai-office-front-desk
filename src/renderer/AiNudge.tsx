import { useState } from 'react';

const AI_TOOLS = [
  { label: 'Claude', url: 'https://claude.ai/new' },
  { label: 'ChatGPT', url: 'https://chatgpt.com' },
  { label: 'Gemini', url: 'https://gemini.google.com' }
];

/** A small, honest nudge toward using AI for this card's content. This app has no AI API of its own
 * (no keys, no network calls to a model), so it can't submit the prompt for you — but it can copy
 * the prompt to the clipboard and open the tool in one click, leaving just a single paste (Cmd+V)
 * once the page loads, instead of a manual copy-then-find-then-open-then-paste round trip. */
export function AiNudge({ prompt }: { prompt: string }) {
  const [expanded, setExpanded] = useState(false);
  const [openedLabel, setOpenedLabel] = useState<string | null>(null);

  async function copyAndOpen(tool: { label: string; url: string }) {
    try { await navigator.clipboard.writeText(prompt); } catch { /* clipboard can fail in some contexts; still open the tool */ }
    await window.frontDesk.openContentLink(tool.url);
    setOpenedLabel(tool.label);
    setTimeout(() => setOpenedLabel(null), 3000);
  }

  return <>
    <button className="ai-nudge" onClick={() => setExpanded(!expanded)}>✨ Ask AI for ideas</button>
    {expanded && <div className="ai-nudge-prompt">
      <p style={{ margin: 0 }}>{prompt}</p>
      <div className="actions" style={{ marginTop: 6 }}>
        {AI_TOOLS.map((tool) => <button key={tool.label} onClick={() => void copyAndOpen(tool)}>Open in {tool.label}</button>)}
        <button onClick={() => setExpanded(false)}>Close</button>
      </div>
      {openedLabel && <p className="form-status" style={{ margin: '6px 0 0' }}>Copied — paste (⌘V) into {openedLabel}.</p>}
    </div>}
  </>;
}
