// Vercel Serverless Function — POST /api/chat
// This runs on the server, never in the visitor's browser, so the API key
// stays hidden. This is the piece that was missing before: the widget used
// to call api.anthropic.com directly from the page, which cannot work
// (no key exposed there, and Anthropic blocks that kind of direct browser call).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Missing ANTHROPIC_API_KEY environment variable on Vercel.');
    return res.status(500).json({ error: 'Server is not configured yet.' });
  }

  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Keep only the last 12 turns so the request stays small and fast
  const trimmedMessages = messages.slice(-12);

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system:
          "You are Relay's helpful AI assistant, embedded on Relay's own marketing site. " +
          "Relay is an autonomous AI agent platform for customer conversations, similar in category to Gupshup — " +
          "it lets businesses automate WhatsApp, SMS, Instagram DM and web chat support and sales. " +
          "Answer questions about what Relay does, how it works, pricing questions generally (say a team member " +
          "can share exact pricing), and how to get started. Keep answers short (2-4 sentences), friendly, and " +
          "confident. If asked something totally unrelated to Relay or customer conversations, answer briefly " +
          "and then steer back to how Relay could help. Never invent specific customer names, contracts, or " +
          "numbers beyond what's reasonable for a product like this.",
        messages: trimmedMessages,
      }),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      console.error('Anthropic API error:', data);
      return res.status(502).json({ error: 'AI service returned an error' });
    }

    const reply =
      data.content?.find((block) => block.type === 'text')?.text ||
      "Let me connect you with our team for that one!";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Server error calling Anthropic:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
