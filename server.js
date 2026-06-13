import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json({ limit: "4mb" }));
app.use(express.static(__dirname));

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const siteStore = new Map();

function checkKey(res) {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "No API key. Add ANTHROPIC_API_KEY to .env" });
    return false;
  }
  return true;
}

// ── PREVIEW STORE ──
app.post("/api/save-preview", (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).json({ error: "No HTML" });
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const cleaned = html.replace(/^```html\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();
  siteStore.set(id, cleaned);
  if (siteStore.size > 50) siteStore.delete([...siteStore.keys()][0]);
  console.log(`Saved preview ${id} — ${cleaned.length} chars`);
  res.json({ id });
});

app.get("/preview/:id", (req, res) => {
  const html = siteStore.get(req.params.id);
  if (!html) return res.status(404).send("<h2>Preview expired. Generate again.</h2>");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
});

// ── LEAD FINDER ──
app.post("/api/leads", async (req, res) => {
  if (!checkKey(res)) return;
  const { category, area } = req.body;
  if (!category || !area) return res.status(400).json({ error: "Category and area required." });
  try {
    const msg = await ai.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 2500,
      messages: [{ role: "user", content: `Generate a realistic list of 10-12 local ${category} businesses in ${area}. Return ONLY valid JSON, no markdown:\n{"businesses":[{"name":"string","category":"${category}","area":"${area}","address":"string","phone":"string","website":"string or null","rating":4.2,"reviews":87,"hasWebsite":true,"hasSocial":true,"hasGMB":true,"notes":"string"}]}` }],
    });
    const text = msg.content.map(b => b.text || "").join("").replace(/^```json\s*/,"").replace(/```\s*$/,"").trim();
    res.json(JSON.parse(text));
  } catch (err) {
    console.error("Lead error:", err.message);
    res.status(500).json({ error: "Lead search failed: " + err.message });
  }
});

// ── AI WEBSITE GENERATOR ──
app.post("/api/generate", async (req, res) => {
  if (!checkKey(res)) return;
  const { prompt } = req.body;
  if (!prompt || prompt.trim().length < 5) return res.status(400).json({ error: "Please describe the business." });

  const systemPrompt = `You are a world-class web designer. Read the business description and make ALL design decisions — colors, fonts, layout, tone — based on what genuinely fits that business.

OUTPUT RULE: Return ONLY raw HTML. Start immediately with <!DOCTYPE html>. No markdown, no fences, nothing else.

DESIGN THINKING: Match the business personality.
Auto shop → industrial, dark bg, condensed bold type, red/amber accent
Spa/salon → soft neutrals, serif headings, lots of whitespace
Kids venue → bright colors, rounded fonts, playful
Law firm → navy/charcoal, clean sans-serif, serious
Brewery → warm browns/ambers, casual, community feel
Restaurant → appetite colors, inviting, food-focused
Gym/trainer → dark + bold accent, athletic, motivational
Make deliberate choices that fit THIS specific business.

ANIMATION RULE — CRITICAL: Use ONLY CSS @keyframes that fire on page load.
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
Apply: .hero-left{animation:fadeUp 0.6s ease both}
NEVER: opacity:0 as default style, IntersectionObserver, AOS, ScrollReveal.
All content must be visible by default.

JS: Only (1) sticky nav scroll shadow, (2) mobile hamburger toggle.

STRUCTURE — build all 8 sections completely:

1. NAV: logo + 4 links + phone + CTA button. Sticky. .scrolled adds shadow on scroll.

2. HERO (min-height:88vh, 2-column grid, padding-top:80px):
Left: eyebrow label, H1 clamp(48px,7vw,88px) — PUNCHY benefit headline not "Welcome to X", 2-sentence sub, 2 CTAs, rating+address
Right: CSS visual — styled stat card or geometric element, looks intentional

3. TRUST BAR: dark bg, infinite CSS marquee, 8 trust signals with ■ separators, uppercase tiny font
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.marquee-inner{display:flex;animation:marquee 30s linear infinite;white-space:nowrap}
Duplicate content for seamless loop.

4. SERVICES: "/ WHAT WE DO" label, big headline, 1 featured full-width card + 2-3 smaller cards. Each card: tag, name, description, "REQUEST →" link, included items with ■ bullets.

5. ABOUT (2-col): CSS photo placeholder left (emoji + stat overlay), right: punchy multi-line headline with ONE accent-colored word, 3 paragraphs, 4 specific stat boxes.

6. REVIEWS (dark bg): Left: HUGE stat headline "[X] REVIEWS. [X.X] STARS. ZERO [WORD]." Right: rating block + Google CTA.

7. CONTACT: Left: booking form with fields relevant to this business type, styled inputs, full-width submit. Right: dark info card with address/phone/hours.

8. FOOTER: Very large business name, 3-col grid, copyright.

COPY: Zero placeholders. Every word specific to THIS business. Hero headline is punchy and memorable. Stats are specific numbers. Tone matches the business.

Build the COMPLETE page — all 8 sections, all CSS, all JS. Do not stop early.`;

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await ai.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 32000,
      system: systemPrompt,
      messages: [{ role: "user", content: `Build a complete, extraordinary website for this business. Read the description carefully and make design decisions that genuinely fit this business's personality and customers:\n\n${prompt.trim()}` }],
    });

    let first = true;
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
        if (first) { console.log("Gen start:", JSON.stringify(chunk.delta.text.slice(0,60))); first = false; }
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Generator error:", err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); }
  }
});

app.get("*", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`\n✅ Sebastian's Website Agency → http://localhost:${PORT}\n`));
