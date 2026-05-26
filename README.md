# AEO Lens

A Claude-powered agent that analyses content for AI-driven discovery across ChatGPT, Claude, Perplexity, and Google AI Overviews. Built as a portfolio prototype.

## What it does

Paste an article, landing page, or blog post. AEO Lens returns:

. **A discoverability score** out of 100, broken down across clarity, structure, citation worthiness, entity richness, and answer readiness.

. **Citation analysis** for each major AI engine, with specific reasoning on whether the content would be cited and what to change if not.

. **Answer snippets** showing the exact 1-3 sentence answers AI engines would extract for relevant queries, with a quality rating for each.

. **Production-ready Schema.org JSON-LD** generated from the content, ready to drop into a page.

. **Entity coverage analysis** identifying entities present in the content and entities missing that would improve LLM retrieval.

. **Q&A reformatting** showing the most impactful prose-to-Q&A transformations.

. **Critical issues and quick wins** prioritised by impact.

## Why it works

Most SEO tools optimise for traditional search rankings. AEO Lens analyses content the way large language models actually consume it: looking for citation-worthy structure, named entities, answer-ready passages, and the kind of precise, well-structured prose that LLM-driven search surfaces reward.

## How it's built

Single-agent architecture using Claude Sonnet 4.6. The agent works through a focused thinking step, then returns a structured JSON analysis covering seven output sections. The frontend renders each section as part of a dashboard-style audit.

Streaming is implemented via Vercel Edge runtime with proper Server-Sent Events parsing, so the function never hits the timeout limit even on detailed analyses.

## Live demo

[https://aeo-lens-demo.vercel.app](https://aeo-lens-demo.vercel.app)

## Credits

[Open AEO Lens →](https://aeo-lens-demo.vercel.app)

Built by [Dora Czerna](https://www.doracee.com/) as a portfolio prototype.
