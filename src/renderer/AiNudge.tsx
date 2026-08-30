import { useState } from 'react';

/** A small, honest nudge toward using AI for this card's content — reveals a copyable suggested
 * prompt rather than pretending to call out to an AI tool directly with it pre-filled. This app has
 * no AI API of its own (no keys, no network calls to a model) and doesn't reach into whichever tool
 * the installer prefers, so "copy a prompt, paste it into Claude/ChatGPT/Gemini yourself" is the one
 * version of this that's actually true rather than a broken deep-link. */
export function AiNudge({ prompt }: { prompt: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail in some contexts — the prompt is still right there to copy by hand.
    }
  }

  return <>
    <button className="ai-nudge" onClick={() => setExpanded(!expanded)}>✨ Ask AI for ideas</button>
    {expanded && <div className="ai-nudge-prompt">
      <p style={{ margin: 0 }}>{prompt}</p>
      <div className="actions" style={{ marginTop: 6 }}>
        <button onClick={() => void copy()}>{copied ? 'Copied!' : 'Copy prompt'}</button>
        <button onClick={() => setExpanded(false)}>Close</button>
      </div>
    </div>}
  </>;
}
