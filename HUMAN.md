# Human Architecture Requests

This file captures all architecture decisions and requirements from the human.

## Core Vision
- AB testing suite specifically designed for vibecoding
- The main statistical problem: how do you get meaningful statistical tests when you have maybe 100 users and you're iterating at lightspeed?
- Needs to at least try and guess what's going to do better if you're poor and spending maybe a couple hundred bucks on ads and getting one conversion vs no conversions

## Delivery Model
- **SaaS** — we host it, users sign up and get a project token + SDK

## Integration
- **Both JS SDK and REST API** — JS SDK for frontend, REST API for backend/language-agnostic

## Target Platform
- **Web apps** (React, Next, etc.) — primary target audience

## Stats Approach
- **Bayesian + multi-armed bandits** — Bayesian stats for small-sample inference, Thompson Sampling bandits to auto-allocate traffic to winners

## Vibecoding-Specific Features
- Dead-simple setup (minimize config, one-liner SDK)
- Speed-oriented workflow (fast experiment cycles, quick decisions, quick iteration)
- Must work with tiny sample sizes — even 1 conversion vs 0 conversions
- Should try to guess what's going to perform better using engagement signals when conversion data is sparse

## Goal Tracking
- **Smart detection** — automatically infer what the conversion action is from page structure (e.g., the submit button on a landing page is probably the conversion)

## Tech Stack
- **TypeScript frontend + Python backend** — Next.js dashboard, FastAPI for the stats engine (better stats libraries)

## Auth
- **GitHub OAuth** (primary) + **email magic links** (fallback)

## Variant Definition
- **Code-first** — define variants in React components with useVariant() hooks, dashboard shows results only

## Hosting
- **OVH VPS** to start, scale later
