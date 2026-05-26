// api/analyse.js
// Vercel Edge runtime - streams Claude's response back to the browser as SSE.
// Same pattern as Content Studio: avoids function timeout, lets the UI show progress.

export const config = {
  runtime: 'edge'
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { content, target_query } = body;

  if (!content || typeof content !== 'string' || content.length < 50) {
    return new Response(JSON.stringify({ error: 'Content must be at least 50 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (content.length > 12000) {
    return new Response(JSON.stringify({ error: 'Content exceeds 12,000 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(content, target_query);

  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        stream: true,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ]
      })
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      return new Response(JSON.stringify({ error: 'Anthropic API error', details: errorText }), {
        status: anthropicResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(anthropicResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server error', message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function buildSystemPrompt() {
  return `You are an Answer Engine Optimisation (AEO) analyst. Your job is to evaluate content for how well it will perform across AI-driven discovery surfaces: ChatGPT, Claude, Perplexity, Google AI Overviews, and other large language model search systems.

You produce a rigorous, structured analysis. You do not soften findings. If content is poorly structured for AEO, you say so directly.

Before producing output, write a brief <thinking> block (2-4 short sentences only) about the content's core topic, primary audience, and the dimensions where it's weakest for AEO. Be terse.

Then produce structured JSON output wrapped in <output> tags. Format must be:

<thinking>
[2-4 short sentences only]
</thinking>

<output>
{
  "task": "aeo_analysis",
  ...
}
</output>

Never produce JSON outside <output> tags. Never produce text after </output>.

OUTPUT SCHEMA:

{
  "task": "aeo_analysis",
  "content_summary": "1-2 sentence neutral summary of what the content is about",
  "primary_topic": "The single core topic in 3-7 words",
  "content_type_detected": "article | landing_page | guide | comparison | tutorial | other",
  "discoverability_score": {
    "overall": 0-100,
    "clarity": 0-100,
    "structure": 0-100,
    "citation_worthiness": 0-100,
    "entity_richness": 0-100,
    "answer_readiness": 0-100,
    "verdict": "One sentence honest verdict about whether AI engines will surface this content"
  },
  "citation_analysis": [
    {
      "engine": "ChatGPT | Claude | Perplexity | Google AI Overviews",
      "would_cite": "yes | partial | no",
      "reasoning": "1-2 sentences on why",
      "what_to_change": "Specific actionable improvement, or 'No changes needed' if would_cite is yes"
    }
  ],
  "answer_snippets": [
    {
      "query": "A natural question this content could answer",
      "snippet": "The 1-3 sentence answer an AI engine would extract verbatim from the content as written",
      "snippet_quality": "strong | adequate | weak",
      "improvement_note": "If weak or adequate, the specific rewrite that would make it strong"
    }
  ],
  "structured_data": {
    "recommended_schema_type": "Schema.org type appropriate to the content (e.g. Article, FAQPage, HowTo, Product)",
    "json_ld": "A complete, valid JSON-LD object as a JSON-encoded string, ready to drop into a page <script type='application/ld+json'> tag. Must be production-ready with all relevant properties populated from the content."
  },
  "entity_coverage": {
    "entities_present": ["List of entities (people, organisations, concepts, products) the content references"],
    "entities_missing": ["Entities the content SHOULD reference for better AI discoverability on this topic but doesn't"],
    "entity_density_assessment": "1 sentence on whether the content is entity-rich enough for LLM retrieval"
  },
  "qa_reformatting": [
    {
      "original_passage": "A passage from the content that's hard for LLMs to retrieve",
      "rewritten_as_qa": "The same information restructured as a clear Q: ... A: ... pair that LLMs prefer"
    }
  ],
  "critical_issues": ["The 2-4 most important problems holding this content back from AEO performance"],
  "quick_wins": ["The 3-5 highest-impact, lowest-effort changes that would meaningfully improve AEO performance"]
}

ANALYSIS PRINCIPLES:

- Do not use em dashes anywhere in your output. Use commas, full stops, colons, or restructure the sentence.
- Be honest about scoring. A score above 80 means the content is genuinely strong. Most real-world content sits in the 40-70 range. Don't inflate.
- Citation analysis must be specific to each engine's actual citation patterns:
  - ChatGPT: prefers structured, definitive answers with clear sources implied
  - Claude: prefers nuanced explanations with explicit reasoning
  - Perplexity: prefers content with concrete entities, dates, numbers
  - Google AI Overviews: prefers content that directly answers user questions with clear structure
- For citation_analysis, include all four engines listed above.
- For answer_snippets, generate 3-5 entries covering different likely queries the content could answer.
- For qa_reformatting, generate 2-3 entries showing the most impactful prose-to-Q&A transformations.
- The json_ld field must contain a complete, valid Schema.org JSON-LD object encoded as a JSON string. Use the actual content's topic, headline, key facts. Do not produce placeholder values like "TITLE HERE".
- entities_missing must be specific. Don't say "industry leaders" - name them. If you can't name them confidently from the content's topic, leave the field thin rather than fabricate.
- critical_issues should be substantive problems, not nitpicks. quick_wins should be genuine quick wins, not "add more keywords".

If the content is too thin (under ~100 words of substance) or appears not to be content meant for discovery (e.g. a personal note, an email), produce an output where overall score is low and the verdict explicitly notes this is not standard content for AEO analysis.

If the target_query field is provided by the user, prioritise answer_snippets generation around that query.`;
}

function buildUserMessage(content, target_query) {
  let message = '';

  if (target_query) {
    message += `TARGET QUERY: ${target_query}\n\n`;
    message += `The user wants this content to perform well for the query above. Prioritise answer_snippets and citation_analysis around this query specifically.\n\n`;
  }

  message += `CONTENT TO ANALYSE:\n<content>\n${content}\n</content>\n\nProduce your <thinking> block, then the JSON output wrapped in <output> tags.`;

  return message;
}
