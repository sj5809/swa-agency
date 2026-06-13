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

function checkKey(res) {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "No API key. Add ANTHROPIC_API_KEY to .env" });
    return false;
  }
  return true;
}

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

  const systemPrompt = `You are a world-class creative director and web designer at a top agency. You receive a business description and make ALL design decisions yourself — colors, fonts, layout, tone, everything — based on what genuinely fits that business's personality, industry, and customers.

CRITICAL OUTPUT RULE: Return ONLY raw HTML starting with <!DOCTYPE html>. No markdown. No code fences. Nothing before or after.

━━━ YOUR DESIGN PROCESS ━━━

Before writing a single line of code, think about this business:
- What industry is it? What do customers FEEL when they walk in?
- What's the personality? (Rugged & honest? Elegant & refined? Fun & energetic? Clean & trustworthy?)
- Who are their customers and what do they respond to?
- What colors, fonts, and layout would a great agency choose for this specific business?

Then design accordingly. Some examples of good thinking:
- Auto shop → industrial, bold, confident. Dark/off-white, heavy condensed type, red accents, no-nonsense copy
- Day spa → calm, luxurious. Soft neutrals, serif headings, lots of whitespace, gentle language  
- Kids' birthday party venue → bright, energetic, fun. Bold colors, rounded fonts, playful copy
- Law firm → serious, trustworthy. Navy/charcoal, clean sans-serif, professional tone
- Craft brewery → warm, authentic. Browns/ambers, casual type, community feel
- Nail salon → chic, friendly. Pinks/golds or clean white, approachable tone
- Food truck → vibrant, casual. Bold colors, punchy copy, street energy
- Personal trainer → motivational, strong. Dark with bright accent, athletic feel
Every business is different. Make deliberate choices that fit THIS one specifically.

━━━ TECHNICAL RULES ━━━

ANIMATIONS — CSS @keyframes ONLY, zero JS animations:
@keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
Apply: element{animation:fadeUp 0.6s ease both} with nth-child delays for stagger
NEVER set opacity:0 as a default style. NEVER use IntersectionObserver. NEVER use AOS/ScrollReveal.
Every element must be visible by default — only inside @keyframes "from" state can opacity be 0.

JAVASCRIPT — only these:
1. Sticky nav: window.addEventListener('scroll',()=>{document.querySelector('nav').classList.toggle('scrolled',window.scrollY>50)})
2. Mobile hamburger menu toggle
3. CSS-only infinite marquee for trust bar (no JS needed)

FONTS: Import from Google Fonts. Choose fonts that match the business personality.
CSS: All in one <style> tag. Mobile responsive. Container max-width 1200px.

━━━ PAGE STRUCTURE — BUILD ALL 8 SECTIONS ━━━

**1. NAVIGATION** (sticky, professional)
- Logo: business name, styled to match your chosen design direction
- 4 relevant nav links for this business type
- Phone number link on the right
- CTA button (Book Now / Order / Call Us / Get a Quote — whatever fits)
- Hamburger for mobile
- On scroll: add shadow via .scrolled class

**2. HERO** (min-height:88vh, two-column grid)
LEFT COLUMN:
- Small eyebrow label: city/neighborhood + est. year (if known)
- H1: HUGE headline (clamp(48px,7vw,88px)). The single most important element.
  Must be punchy, benefit-led, specific to this business. Makes someone stop scrolling.
  DO NOT write "Welcome to [Name]" or "[Name] — Quality [Service]"
  THINK like a copywriter. What's the one thing that makes this business worth choosing?
- 2-sentence subheadline
- Two CTAs: primary action button + phone/secondary
- Star rating + review count + address (if provided)

RIGHT COLUMN:
- A styled visual element using pure CSS — no images needed
- Choose what makes sense: geometric shapes, gradient card, pattern, large stat display
- Should reinforce the brand feeling you've established
- Can be: a bold stat card, an abstract CSS illustration, a styled info card
- Must look intentional, not like a placeholder

**3. TRUST BAR** (infinite scrolling marquee)
- Dark background (near-black or very dark version of your palette)
- Light text scrolling infinitely
- 8-10 trust signals relevant to THIS business, separated by ■
- Examples for auto shop: "ASE-CERTIFIED MECHANICS ■ 12-MONTH WARRANTY ■ FAMILY-OWNED SINCE 1987"
- Examples for restaurant: "FRESH INGREDIENTS DAILY ■ LOCALLY SOURCED ■ OPEN 7 DAYS"
- Font: uppercase, tight tracking, small size (0.72rem)
CSS marquee:
.marquee-inner{display:flex;animation:marquee 30s linear infinite;white-space:nowrap}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
Duplicate content for seamless loop.

**4. SERVICES / MENU / OFFERINGS** (editorial card layout)
- Section label styled as "/ WHAT WE DO" or "/ OUR SERVICES" (slash prefix, small caps, accent color)
- Big bold section headline relevant to this business
- Featured/primary service: full-width large card
- 2-3 additional services: side-by-side smaller cards
- Each card: category tag, service name in display font, description, action link, included items list with ■ bullets
- Card borders, subtle backgrounds, hover lift effect (CSS only: transform:translateY(-3px))

**5. ABOUT / WHY US** (two column)
- Photo placeholder left: CSS styled box with relevant emoji + overlay with business stat
- Right: Multi-line headline with ONE word/phrase in accent color for punch
- 2-3 paragraphs of real business story
- 4 stat boxes below: specific numbers, not vague ("1,200+ Customers" not "Many Customers")

**6. REVIEWS / SOCIAL PROOF** (dark background section)
- Dark background
- BIG typographic headline on the left using actual review stats
  Format: "[X] REVIEWS. [X.X] STARS. ZERO [PLAYFUL WORD]." — adapt tone to business
- Right side: rating display + source + CTA to read reviews
- This section should feel CONFIDENT, like bragging rights

**7. CONTACT / BOOKING** (split layout)
- Left: full booking/contact form
  Fields relevant to this business type:
  - Auto shop: Name, Phone, Vehicle Year/Make/Model, Service needed, Preferred date
  - Restaurant: Name, Party size, Date, Time, Special requests  
  - Service business: Name, Phone, Email, Service needed, Preferred date, Notes
  Styled inputs with focus states
  Full-width submit button
- Right: dark info card — address, phone, email, hours

**8. FOOTER** (dark, editorial)
- Very large business name at top (clamp(36px,5vw,64px)) in light color
- 3-4 column grid: links, services list, contact, hours
- Social links
- Copyright line

━━━ COPY RULES ━━━
1. ZERO placeholder text — every single word written for THIS specific business
2. Hero headline must be the best line in the page — punchy, specific, memorable  
3. Service descriptions: real things this type of business actually does
4. Testimonials/stats: realistic specific numbers
5. Use the real address, phone, and rating if provided in the description
6. Tone must match the business — a gym sounds different from a florist
7. CTA buttons: action-specific ("Book My Appointment" not just "Click Here")
8. Section labels use slash prefix: "/ WHAT WE DO", "/ ABOUT THE SHOP", "/ WHAT CUSTOMERS SAY"

━━━ QUALITY BAR ━━━
This must look like an $8,000 agency website. Ask yourself:
- Would a real business owner be proud to show this to customers?
- Does the typography create strong visual hierarchy?
- Is the color palette cohesive and intentional?
- Does the copy sound human and confident, not generic?
- Is every section purposeful, not filler?

OUTPUT: <!DOCTYPE html> immediately. Build the full page. Make it extraordinary.`;

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await ai.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
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
