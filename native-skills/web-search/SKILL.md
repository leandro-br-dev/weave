---
name: web-search
description: >
  Internet search skill for AI agents. Perform web searches using DuckDuckGo,
  fetch and read URLs, search GitHub issues/code, and search Stack Overflow.
  Use when the user needs to search the web, look up documentation, find code
  examples, research errors, or get current information from the internet.
  Triggers include requests to "search the web", "look up", "find information",
  "research", "google", or any task requiring internet access.
allowed-tools: Bash(curl *), Bash(python3 *), Bash(agent-browser *)
---

# Web Search Skill

Use this skill when you need to search the internet for information. This skill provides multiple search methods depending on what you need.

## Method 1: DuckDuckGo HTML Search (Recommended — No API Key)

Search DuckDuckGo and parse results using curl + Python:

```bash
curl -s "https://html.duckduckgo.com/html/?q=YOUR+QUERY+HERE" | python3 -c "
import sys, re
from urllib.parse import unquote
html = sys.stdin.read()
results = re.findall(r'class=\"result__a\"[^>]*href=\"(.*?)\"[^>]*>(.*?)</a>', html, re.DOTALL)
snippets = re.findall(r'class=\"result__snippet\"[^>]*>(.*?)</', html, re.DOTALL)
for i, ((url, title), snippet) in enumerate(zip(results[:5], snippets[:5])):
    clean_title = re.sub(r'<[^>]+>', '', title).strip()
    if 'uddg=' in url:
        clean_url = unquote(url.split('uddg=')[1].split('&')[0])
    else:
        clean_url = url
    print(f'{i+1}. {clean_title}')
    print(f'   {clean_url}')
    if snippet:
        clean_snippet = re.sub(r'<[^>]+>', '', snippet).strip()
        print(f'   {clean_snippet}')
    print()
"
```

**Important:** Replace spaces in your query with `+` signs. Limit results to 5-10 for context efficiency.

## Method 2: Fetch and Read a URL (Using agent-browser)

If agent-browser is available, use it to read full web pages:

```bash
agent-browser open https://example.com
agent-browser wait --load networkidle
agent-browser get text body
```

## Method 3: Fetch and Read a URL (Using curl + Python)

```bash
curl -sL "https://example.com/page" | python3 -c "
import sys, re
html = sys.stdin.read()
html = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.DOTALL|re.IGNORECASE)
html = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
text = re.sub(r'<[^>]+>', ' ', html)
text = re.sub(r'\s+', ' ', text).strip()
print(text[:5000])
"
```

## Method 4: GitHub Search

```bash
curl -s "https://api.github.com/search/issues?q=YOUR+QUERY&per_page=5" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data.get('items', [])[:5]:
    print(f'- {item[\"title\"]}')
    print(f'  URL: {item[\"html_url\"]}')
    print(f'  State: {item[\"state\"]}')
    print()
"
```

## Method 5: Stack Overflow Search

```bash
curl -s "https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=YOUR+QUERY&site=stackoverflow&pagesize=3" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data.get('items', [])[:3]:
    print(f'- {item[\"title\"]}')
    print(f'  URL: {item[\"link\"]}')
    print(f'  Score: {item[\"score\"]} | Answers: {item[\"answer_count\"]}')
    print()
"
```

## Quick Reference

| Need | Method | Speed |
|------|--------|-------|
| General web search | Method 1 (DuckDuckGo) | Fast |
| Read full page (interactive) | Method 2 (agent-browser) | Medium |
| Read full page (no browser) | Method 3 (curl + Python) | Fast |
| Search GitHub issues/code | Method 4 (GitHub API) | Fast |
| Search Stack Overflow | Method 5 (Stack Exchange API) | Fast |

## Tips

- Always URL-encode search queries (replace spaces with `+`)
- Prefer Method 1 (DuckDuckGo) for quick lookups — it is the fastest and requires no API key
- Use Method 2 (agent-browser) when you need to interact with a page (click, fill forms, navigate)
- Truncate page content to 5000 chars max for context efficiency
- Always include source URLs in your response when providing search results
