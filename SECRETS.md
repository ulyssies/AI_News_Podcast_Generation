# Secrets and environment variables

This file explains how to keep API keys and other secrets **out of git** so you can safely push the repo.

## What is ignored

- **`api/.env`** – Your real API keys live here. It is listed in `.gitignore` and will **not** be committed.
- Any other `.env` or `.env.local` files in the project.

## First-time setup (or after cloning)

1. Copy the example file (no keys):
   ```bash
   cp api/.env.example api/.env
   ```
2. Edit **`api/.env`** and add your real values, for example:
   ```bash
   OPENAI_API_KEY=sk-your-actual-key-here
   # Optional: use Claude for the script (TTS still uses OpenAI)
   # ANTHROPIC_API_KEY=sk-ant-api03-...
   ```
3. Do **not** commit `api/.env`. Only `api/.env.example` (with placeholders) is in the repo.

## What to commit

- **Do commit:** `api/.env.example` (template with placeholders like `sk-...`).
- **Do not commit:** `api/.env` or any file containing real API keys or secrets.

## If you use other secret files

If you add something like `secrets.json` or `secrets.yaml`, add its name to `.gitignore` so it is never committed.
