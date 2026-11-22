// scripts/build-and-sync.mjs (Run via GitHub Actions in content-studio)
import fs from 'node:fs';
import path from 'node:path';

const INSIGHTS_DIR = path.resolve('studio/site-data/insights');
const PORTFOLIO_DIR = path.resolve('portfolio');
const OUT_DATA_DIR = path.join(PORTFOLIO_DIR, 'site-data/insights');

fs.mkdirSync(OUT_DATA_DIR, { recursive: true });

// 1. Read index.json or scan individual .json files
const indexPath = path.join(INSIGHTS_DIR, 'index.json');
let rawIndex = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : [];
let items = Array.isArray(rawIndex) ? rawIndex : (rawIndex.items || rawIndex.articles || []);

// Filter only approved/published entries
const published = items
  .filter(item => !item.status || /^(approved|published|live)$/i.test(item.status))
  .sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))); // Chronological for blog-1, blog-2...

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function renderBodyHtml(article) {
  const blocks = article.paragraphs || article.sections || article.body || article.content || '';
  if (Array.isArray(blocks)) {
    return blocks.map(b => {
      if (typeof b === 'string') return `<p>${esc(b)}</p>`;
      const h = b.heading || b.title ? `<h2>${esc(b.heading || b.title)}</h2>` : '';
      const p = Array.isArray(b.paragraphs)
        ? b.paragraphs.map(t => `<p>${esc(t)}</p>`).join('\n')
        : `<p>${esc(b.body || b.text || '')}</p>`;
      return `${h}\n${p}`;
    }).join('\n');
  }
  return String(blocks).split(/\n{2,}/).map(blk => {
    const t = blk.trim();
    if (!t) return '';
    const m = t.match(/^#{1,3}\s+(.*)$/);
    return m ? `<h2>${esc(m[1])}</h2>` : `<p>${esc(t)}</p>`;
  }).join('\n');
}

function buildBlogPageHtml(article, routeSlug, prevRoute, nextRoute) {
  const title = article.title || routeSlug;
  const summary = article.summary || article.excerpt || '';
  const tag = article.tag || article.category || 'The Frontline Voice';
  const date = article.date || new Date().toISOString().slice(0, 10);
  const bodyHtml = renderBodyHtml(article);

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="color-scheme" content="dark light">
    <title>${esc(title)} | Deepak Kondappa</title>
    <meta name="description" content="${esc(summary)}">
    <meta property="og:title" content="${esc(title)} | Deepak Kondappa">
    <meta property="og:description" content="${esc(summary)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://deepakkondappa.codes/${routeSlug}/">
    <link rel="canonical" href="https://deepakkondappa.codes/${routeSlug}/">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%230d1017'/%3E%3Crect x='2' y='2' width='60' height='60' rx='14' fill='none' stroke='%23e5a93c' stroke-opacity='0.6' stroke-width='2'/%3E%3Ctext x='31' y='41' text-anchor='middle' font-family='system-ui,-apple-system,sans-serif' font-weight='900' font-size='25' fill='%23ffffff'%3ED%3Ctspan fill='%23e5a93c'%3EK%3C/tspan%3E%3C/text%3E%3C/svg%3E">
    <script>
        (function() {
            try {
                const saved = localStorage.getItem('dk_theme');
                const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
                document.documentElement.setAttribute('data-theme', saved || (prefersLight ? 'light' : 'dark'));
            } catch (e) {}
        })();
    </script>
    <style>
        :root, [data-theme="dark"] {
            --bg-page: #07080b; --bg-elevated: #0d1017; --bg-card: #11141c; --bg-nav: rgba(7, 8, 11, 0.88);
            --border-subtle: rgba(255, 255, 255, 0.09); --text-title: #ffffff; --text-body: #d5d9e2; --text-muted: #949ba9;
            --accent: #e5a93c; --accent-contrast: #07080b; --sage-text: #9db6a5; --sage-dim: rgba(124, 144, 130, 0.16);
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
            --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        [data-theme="light"] {
            --bg-page: #f5f6f8; --bg-elevated: #ffffff; --bg-card: #ffffff; --bg-nav: rgba(245, 246, 248, 0.9);
            --border-subtle: rgba(15, 23, 42, 0.1); --text-title: #0f172a; --text-body: #334155; --text-muted: #5b6678;
            --accent: #b87a14; --accent-contrast: #ffffff; --sage-text: #3d5445; --sage-dim: rgba(75, 99, 83, 0.12);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: var(--font-sans); background: var(--bg-page); color: var(--text-body); line-height: 1.75; }
        #progress { position: fixed; top: 0; left: 0; height: 3px; width: 0%; background: var(--accent); z-index: 200; }
        header { position: sticky; top: 0; z-index: 100; background: var(--bg-nav); backdrop-filter: blur(14px); border-bottom: 1px solid var(--border-subtle); }
        .nav-inner { max-width: 820px; margin: 0 auto; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; }
        .brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: var(--text-title); font-weight: 800; font-size: 0.88rem; }
        .monogram { width: 36px; height: 36px; border-radius: 10px; background: var(--bg-elevated); border: 1px solid rgba(229,169,60,0.48); display: inline-flex; align-items: center; justify-content: center; font-weight: 900; }
        .monogram span { color: var(--accent); }
        .icon-btn { background: var(--bg-card); border: 1px solid var(--border-subtle); color: var(--text-title); min-height: 40px; padding: 0 12px; border-radius: 10px; cursor: pointer; font-weight: 700; }
        main { max-width: 760px; margin: 0 auto; padding: clamp(36px, 6vw, 64px) 20px 80px; }
        .meta-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px; font-family: var(--font-mono); font-size: 0.74rem; }
        .pill { background: var(--sage-dim); color: var(--sage-text); padding: 4px 10px; border-radius: 6px; font-weight: 700; text-transform: uppercase; }
        h1 { font-size: clamp(1.8rem, 4vw, 2.65rem); font-weight: 900; color: var(--text-title); line-height: 1.18; letter-spacing: -0.8px; margin-bottom: 16px; }
        .lead { font-size: 1.12rem; color: var(--text-muted); margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid var(--border-subtle); }
        article h2 { font-size: 1.32rem; font-weight: 800; color: var(--text-title); margin: 32px 0 12px; }
        article p { margin-bottom: 18px; font-size: 1.02rem; }
        .post-nav { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .btn { display: inline-flex; align-items: center; min-height: 44px; padding: 10px 18px; border-radius: 999px; border: 1px solid var(--accent); color: var(--accent); text-decoration: none; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; }
        .btn:hover { background: var(--accent); color: var(--accent-contrast); }
    </style>
</head>
<body>
    <div id="progress"></div>
    <header>
        <div class="nav-inner">
            <a href="/" class="brand"><span class="monogram">D<span>K</span></span> ← Back to Portfolio</a>
            <button type="button" class="icon-btn" id="themeBtn" aria-label="Toggle Theme">☀</button>
        </div>
    </header>
    <main>
        <div class="meta-row">
            <span class="pill">${esc(tag)}</span>
            <span style="color: var(--text-muted);">${esc(date)} • The Frontline Voice</span>
        </div>
        <h1>${esc(title)}</h1>
        <p class="lead">${esc(summary)}</p>
        <article>${bodyHtml}</article>
        <nav class="post-nav" aria-label="Article Navigation">
            <a href="${prevRoute}" class="btn">← Previous</a>
            <a href="${nextRoute}" class="btn">Next →</a>
        </nav>
    </main>
    <script>
        const btn = document.getElementById('themeBtn');
        function setTheme(t) {
            document.documentElement.setAttribute('data-theme', t);
            btn.textContent = t === 'light' ? '☾' : '☀';
            try { localStorage.setItem('dk_theme', t); } catch (e) {}
        }
        setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
        btn.addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'));
        window.addEventListener('scroll', () => {
            const h = document.documentElement.scrollHeight - window.innerHeight;
            document.getElementById('progress').style.width = h > 0 ? \`\${(window.scrollY / h) * 100}%\` : '0%';
        }, { passive: true });
    </script>
</body>
</html>`;
}

// 2. Generate /blog-1/index.html, /blog-2/index.html, etc.
const manifest = [];
published.forEach((entry, idx) => {
  const slugFile = path.join(INSIGHTS_DIR, `${entry.slug}.json`);
  const fullData = fs.existsSync(slugFile)
    ? { ...entry, ...JSON.parse(fs.readFileSync(slugFile, 'utf8')) }
    : entry;

  const routeSlug = `blog-${idx + 1}`;
  const prevRoute = idx === 0 ? '/#insights' : `/blog-${idx}/`;
  const nextRoute = idx === published.length - 1 ? '/#insights' : `/blog-${idx + 2}/`;

  const blogDir = path.join(PORTFOLIO_DIR, routeSlug);
  fs.mkdirSync(blogDir, { recursive: true });
  fs.writeFileSync(
    path.join(blogDir, 'index.html'),
    buildBlogPageHtml(fullData, routeSlug, prevRoute, nextRoute),
    'utf8'
  );

  manifest.push({
    slug: entry.slug,
    route: `/${routeSlug}/`,
    title: fullData.title,
    summary: fullData.summary || fullData.excerpt || '',
    tag: fullData.tag || `Essay ${String(idx + 1).padStart(2, '0')}`,
    date: fullData.date || '',
    linkedinPost: fullData.linkedinPost || `${fullData.title}\n\n${fullData.summary || ''}\n\nRead the full field note: https://deepakkondappa.codes/${routeSlug}/\n\n#MarTech #AEM #ContentOperations #DigitalTransformation`
  });
});

// 3. Write clean local manifest to portfolio repo
fs.writeFileSync(path.join(OUT_DATA_DIR, 'index.json'), JSON.stringify(manifest, null, 2), 'utf8');

// 4. Auto-generate sitemap.xml for SEO
const urls = ['https://deepakkondappa.codes/', ...manifest.map(m => `https://deepakkondappa.codes${m.route}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
  urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')
}\n</urlset>\n`;
fs.writeFileSync(path.join(PORTFOLIO_DIR, 'sitemap.xml'), sitemap, 'utf8');

// 5. Export latest post's LinkedIn copy for GitHub Action notification
if (manifest.length > 0) {
  const latest = manifest[manifest.length - 1];
  fs.writeFileSync('linkedin-ready.txt', latest.linkedinPost, 'utf8');
}
console.log(`Synced ${manifest.length} blog pages to portfolio.`);
