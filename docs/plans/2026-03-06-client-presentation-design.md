# Client Presentation Design

## Goal

Create a Chinese, customer-facing PowerPoint deck that introduces the current `homework-helper` project as a polished multi-model homework assistance product. The deck should emphasize business value first, while still giving enough technical substance to make the solution feel credible and deployable.

## Audience

Prospective clients evaluating whether this product can support tutoring, homework guidance, or education-service workflows.

## Assumptions

- The user explicitly asked to skip further confirmation and proceed directly.
- The deck should stay grounded in the current repository capabilities and avoid invented KPI claims.
- The visual direction should align with the current product UI: dark, modern, premium, product-demo oriented.
- Output format should be `16:9`, Chinese copy, around `9` slides.

## Core Message

This project is not just a generic AI chat box. It is a web-based homework assistance workspace that combines:

- multi-model comparison across OpenAI, Gemini, and Claude
- multimodal input via text, image, and PDF
- structured answer delivery with reasoning visibility
- conversation continuity, model control, and deployment-friendly safeguards

## Slide Outline

1. Cover
   Position the product as a multi-model homework assistant for education-service scenarios.
2. Customer Pain Points
   Explain fragmentation, unstable answer quality, and low operational control.
3. Solution Overview
   Show the end-to-end workflow from upload to model comparison and session reuse.
4. Product Experience
   Use desktop, mobile, and settings screenshots to show the interface and workflow.
5. AI Capability And Differentiation
   Highlight multi-provider orchestration, response tiers, multimodal input, reasoning display, and bilingual output.
6. Technical Architecture
   Show the Next.js UI, session state, API layer, provider adapters, and SSE streaming path.
7. Security And Operational Control
   Describe Basic Auth, environment-based key/config control, tool toggles, and resilience features.
8. Delivery Path
   Frame the current app as a strong pilot foundation and outline near-term extension paths.
9. Closing
   Re-state business value, suitable scenarios, and suggested next step for a pilot.

## Visual Direction

- Dark background with electric blue accents derived from the current product UI
- Large typography, wide spacing, and card-based sections
- Use existing desktop/mobile screenshots from `output/playwright/isabby-ui`
- Mix of product visuals and simplified architecture diagrams built from native PowerPoint shapes

## Verification Plan

1. Generate the deck source in JavaScript with PptxGenJS.
2. Export the `.pptx`.
3. Export a PDF via a local macOS presentation app if available.
4. Render the PDF into PNG previews and create a montage for visual inspection.
