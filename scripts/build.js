#!/usr/bin/env node
// Builds the static site from src/ into the repository root.
// No dependencies. Run with: node scripts/build.js
// Outputs (all committed): index.html, <slug>/index.html, <slug>/index.md,
// 404.html, sitemap.xml, llms.txt, llms-full.txt and css/style.min.css.

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const SITE = {
  url: 'https://sshmonitor.com',
  name: 'SSH Monitor',
  logoText: 'SSHMonitor',
  repo: 'https://github.com/forwardemail/sshmonitor.com',
  summary:
    'SSH Monitor is a free Bash script from the Forward Email team. It reads the new lines in your SSH log, counts failed login attempts and emails you a report through Forward Email when they pass a threshold.',
  ogImage: '/images/og-image.png',
  ogImageAlt: 'SSH Monitor: free SSH login alerts by email, from the Forward Email team',
  themeColor: '#1a365d'
};

const ORG = {
  '@type': 'Organization',
  '@id': 'https://forwardemail.net/#organization',
  name: 'Forward Email',
  url: 'https://forwardemail.net',
  logo: 'https://forwardemail.net/img/logo-square-180x180.png',
  sameAs: [
    'https://github.com/forwardemail',
    'https://x.com/fwdemail',
    'https://www.youtube.com/forwardemail',
    'https://www.reddit.com/r/forwardemail/'
  ],
  contactPoint: [
    { '@type': 'ContactPoint', contactType: 'customer support', email: 'support@forwardemail.net', url: 'https://forwardemail.net/en/faq' },
    { '@type': 'ContactPoint', contactType: 'security', email: 'security@forwardemail.net', url: 'https://forwardemail.net/en/security' }
  ]
};

// ---------------------------------------------------------------------------
// Front matter and Markdown (small subset: headings, paragraphs, lists,
// fenced code, tables, :::cards blocks, inline code, bold, links).
// ---------------------------------------------------------------------------

function parseFrontMatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error('missing front matter');
  const data = {};
  for (const line of match[1].split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }

  return { data, body: text.slice(match[0].length) };
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z\d\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = escapeHtml(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const external = /^https?:\/\//.test(href) && !href.startsWith(SITE.url);
    return `<a href="${href}"${external ? ' rel="noopener"' : ''}>${label}</a>`;
  });
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[i])}</code>`);
  return s;
}

function plain(text) {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1');
}

// Returns { html, headings: [{level, text, id}], blocks: [{type, ...}] }
function markdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const headings = [];
  const blocks = [];
  const ids = new Set();
  let pendingCaption = null;
  let i = 0;

  const isBlockStart = (l) =>
    /^(#{1,4}) /.test(l) ||
    /^```/.test(l) ||
    /^- /.test(l) ||
    /^\d+\. /.test(l) ||
    /^\|/.test(l) ||
    /^:::/.test(l);

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    let m;
    if ((m = /^:::(\w+)?\s*$/.exec(line))) {
      if (m[1] === 'cards') out.push('<div class="card-grid">');
      else out.push('</div>');
      // Track card grouping so h3 inside cards become card containers.
      blocks.push({ type: m[1] ? 'open' : 'close' });
      i++;
      continue;
    }

    if ((m = /^(#{1,4}) (.+)$/.exec(line))) {
      const level = m[1].length;
      const text = m[2].trim();
      let id = slugify(plain(text));
      let n = 2;
      while (ids.has(id)) id = `${slugify(plain(text))}-${n++}`;
      ids.add(id);
      headings.push({ level, text: plain(text), id });
      blocks.push({ type: 'heading', level, text: plain(text), id });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    if ((m = /^```(\w*)/.exec(line))) {
      const lang = m[1];
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      const label = lang ? ` data-lang="${lang}"` : '';
      out.push(
        `<pre${label} tabindex="0"><code${lang ? ` class="language-${lang}"` : ''}>${escapeHtml(code.join('\n'))}</code></pre>`
      );
      blocks.push({ type: 'code', lang, text: code.join('\n') });
      continue;
    }

    if (/^Table: /.test(line) && /^\|/.test(lines[i + 1] || '')) {
      pendingCaption = line.replace(/^Table: /, '').trim();
      i++;
      continue;
    }

    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) =>
        r
          .replace(/^\|/, '')
          .replace(/\|\s*$/, '')
          .split('|')
          .map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      let html = `<div class="table-container" tabindex="0" role="region" aria-label="${escapeHtml(head.map(plain).join(", "))}"><table><thead><tr>`;
      html = html.replace('<table><thead>', `<table${head.length >= 4 ? ' class="wide"' : ''}>${pendingCaption ? `<caption>${inline(pendingCaption)}</caption>` : ''}<thead>`);
      html += head.map((c) => `<th scope="col">${inline(c)}</th>`).join('');
      html += '</tr></thead><tbody>';
      for (const r of body) {
        html += '<tr>' + r.map((c, j) => (j === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('') + '</tr>';
      }

      html += '</tbody></table></div>';
      out.push(html);
      blocks.push({ type: 'table', text: [head, ...body].map((r) => r.map(plain).join(' | ')).join('\n') });
      pendingCaption = null;
      continue;
    }

    if (/^(- |\d+\. )/.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items = [];
      while (i < lines.length && (/^(- |\d+\. )/.test(lines[i]) || /^ {2,}\S/.test(lines[i]))) {
        if (/^(- |\d+\. )/.test(lines[i])) items.push(lines[i].replace(/^(- |\d+\. )/, ''));
        else items[items.length - 1] += ' ' + lines[i].trim();
        i++;
      }

      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`);
      blocks.push({ type: 'list', text: items.map((t) => '- ' + plain(t)).join('\n') });
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) para.push(lines[i++].trim());
    const text = para.join(' ');
    out.push(`<p>${inline(text)}</p>`);
    blocks.push({ type: 'p', text: plain(text) });
  }

  return { html: wrapCards(out.join('\n')), headings, blocks };
}

// Inside a card grid, wrap each h3 and the content that follows it in a card.
function wrapCards(html) {
  return html.replace(/<div class="card-grid">\n([\s\S]*?)\n<\/div>/g, (_, inner) => {
    const parts = inner.split(/\n(?=<h3 )/);
    return (
      '<div class="card-grid">\n' +
      parts.map((p) => `<div class="card">\n${p}\n</div>`).join('\n') +
      '\n</div>'
    );
  });
}

// Markdown copy for /<slug>/index.md and llms-full.txt (drops ::: markers).
function cleanMarkdown(md) {
  return md
    .split('\n')
    .filter((l) => !/^:::/.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function loadPages() {
  const dir = path.join(SRC, 'pages');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { data, body } = parseFrontMatter(fs.readFileSync(path.join(dir, f), 'utf8'));
      const slug = data.slug === '/' ? '' : data.slug.replace(/^\/|\/$/g, '');
      return {
        file: `src/pages/${f}`,
        slug,
        urlPath: slug ? `/${slug}/` : '/',
        url: SITE.url + (slug ? `/${slug}/` : '/'),
        order: Number(data.order || 99),
        title: data.title,
        description: data.description,
        h1: data.h1,
        lead: data.lead,
        nav: data.nav,
        crumb: data.crumb || data.nav,
        type: data.type || 'WebPage',
        llms: data.llms,
        body,
        md: markdown(body)
      };
    })
    .sort((a, b) => a.order - b.order);
}

function icon(name) {
  const icons = {
    github:
      '<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>',
    x: '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
    youtube:
      '<path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>'
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
}

function header(pages, current) {
  const links = pages
    .filter((p) => p.nav && p.slug)
    .map((p) => {
      const active = current && current.slug === p.slug ? ' aria-current="page"' : '';
      return `<li><a href="${p.urlPath}"${active}>${escapeHtml(p.nav)}</a></li>`;
    })
    .join('');
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container header-content">
    <a class="logo" href="/"${current && current.slug === '' ? ' aria-current="page"' : ''}>${SITE.logoText}</a>
    <nav aria-label="Main">
      <ul class="nav-links">${links}<li><a href="https://forwardemail.net" class="btn-primary" rel="noopener">Try Forward Email</a></li></ul>
    </nav>
  </div>
</header>`;
}

function footer(pages, current) {
  const siteLinks = pages
    .filter((p) => p.nav)
    .map((p) => `<li><a href="${p.urlPath}">${escapeHtml(p.crumb || p.nav)}</a></li>`)
    .join('');
  const editUrl = current ? `${SITE.repo}/blob/main/${current.file}` : SITE.repo;
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-column">
        <p class="footer-title">SSH Monitor</p>
        <p>A free SSH log monitoring script from the <a href="https://forwardemail.net" rel="noopener">Forward Email</a> team. It emails you when failed SSH logins pile up.</p>
        <div class="social-links">
          <a href="https://github.com/forwardemail" rel="noopener">${icon('github')}<span class="sr-only">Forward Email on GitHub</span></a>
          <a href="https://x.com/fwdemail" rel="noopener">${icon('x')}<span class="sr-only">Forward Email on X</span></a>
          <a href="https://www.youtube.com/forwardemail" rel="noopener">${icon('youtube')}<span class="sr-only">Forward Email on YouTube</span></a>
        </div>
      </div>
      <div class="footer-column">
        <p class="footer-title">Guides</p>
        <ul>${siteLinks}</ul>
      </div>
      <div class="footer-column">
        <p class="footer-title">Forward Email</p>
        <ul>
          <li><a href="https://forwardemail.net" rel="noopener">Forward Email home</a></li>
          <li><a href="https://forwardemail.net/en/pricing" rel="noopener">Plans and pricing</a></li>
          <li><a href="https://forwardemail.net/en/email-api" rel="noopener">Email API reference</a></li>
          <li><a href="https://forwardemail.net/en/faq" rel="noopener">Forward Email FAQ</a></li>
        </ul>
      </div>
      <div class="footer-column">
        <p class="footer-title">Project</p>
        <ul>
          <li><a href="${SITE.repo}" rel="noopener">Source code on GitHub</a></li>
          <li><a href="${SITE.repo}/issues" rel="noopener">Report an issue</a></li>
          <li><a href="${SITE.repo}/blob/main/ssh_monitor.sh" rel="noopener">Read ssh_monitor.sh</a></li>
          <li><a href="https://forwardemail.net/en/security" rel="noopener">Report a security issue</a></li>
          <li><a href="/about/#privacy-note">Privacy policy</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>SSH Monitor is made by the Forward Email team. No cookies, no tracking.</p>
      <a href="${editUrl}" class="edit-link" rel="noopener">${icon('github')} Edit this page on GitHub</a>
    </div>
  </div>
</footer>`;
}

function jsonLd(page, pages) {
  const website = {
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    url: `${SITE.url}/`,
    name: SITE.name,
    description: SITE.summary,
    inLanguage: 'en',
    publisher: { '@id': ORG['@id'] }
  };
  const software = {
    '@type': 'SoftwareApplication',
    '@id': `${SITE.url}/#software`,
    name: 'SSH Monitor',
    alternateName: 'ssh_monitor.sh',
    description:
      'Bash script that reads new SSH log lines (auth.log, secure or the systemd journal), counts failed login attempts and emails a report through the Forward Email API or sendmail when a threshold is reached.',
    url: `${SITE.url}/`,
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Linux',
    downloadUrl: `${SITE.url}/ssh_monitor.sh`,
    installUrl: `${SITE.url}/install/`,
    softwareRequirements: 'bash, awk, sed, GNU coreutils, curl or sendmail, cron',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@id': ORG['@id'] },
    publisher: { '@id': ORG['@id'] }
  };
  const webpage = {
    '@type': page.type === 'FAQPage' ? 'FAQPage' : page.type === 'AboutPage' ? 'AboutPage' : 'WebPage',
    '@id': `${page.url}#webpage`,
    url: page.url,
    name: page.h1,
    description: page.description,
    inLanguage: 'en',
    isPartOf: { '@id': website['@id'] },
    publisher: { '@id': ORG['@id'] },
    primaryImageOfPage: { '@type': 'ImageObject', url: SITE.url + SITE.ogImage, width: 1200, height: 630 }
  };
  const graph = [ORG, website, webpage];

  if (page.slug === '' || page.slug === 'install') {
    graph.push(software);
    webpage.about = { '@id': software['@id'] };
  }

  if (page.slug) {
    const crumbs = {
      '@type': 'BreadcrumbList',
      '@id': `${page.url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE.url}/` },
        { '@type': 'ListItem', position: 2, name: page.crumb, item: page.url }
      ]
    };
    webpage.breadcrumb = { '@id': crumbs['@id'] };
    graph.push(crumbs);
  }

  if (page.type === 'FAQPage') {
    webpage.mainEntity = sectionsUnder(page, 2)
      .filter((s) => s.heading.endsWith('?'))
      .map((s) => ({
        '@type': 'Question',
        name: s.heading,
        acceptedAnswer: { '@type': 'Answer', text: s.text }
      }));
  }

  if (page.type === 'HowTo') {
    const steps = sectionsUnder(page, 2).filter((s) => /^Step \d+: /.test(s.heading));
    graph.push({
      '@type': 'HowTo',
      '@id': `${page.url}#howto`,
      name: page.h1,
      description: page.description,
      tool: [{ '@type': 'HowToTool', name: 'A Linux server with root access' }],
      step: steps.map((s, n) => ({
        '@type': 'HowToStep',
        position: n + 1,
        name: s.heading.replace(/^Step \d+: /, ''),
        text: s.text,
        url: `${page.url}#${s.id}`
      }))
    });
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

// Collect the text under each heading of a given level.
function sectionsUnder(page, level) {
  const out = [];
  let cur = null;
  for (const b of page.md.blocks) {
    if (b.type === 'heading' && b.level <= level) {
      cur = b.level === level ? { heading: b.text, id: b.id, parts: [] } : null;
      if (cur) out.push(cur);
      continue;
    }

    if (cur && b.type !== 'open' && b.type !== 'close' && b.type !== 'heading') cur.parts.push(b.text);
  }

  return out.map((s) => ({ heading: s.heading, id: s.id, text: s.parts.join('\n\n') }));
}

function layout(page, pages) {
  const isHome = page.slug === '';
  const mdHref = page.slug ? `/${page.slug}/index.md` : '/index.md';
  const crumbs = page.slug
    ? `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><span aria-current="page">${escapeHtml(page.crumb)}</span></li></ol></nav>`
    : '';
  const cta = isHome
    ? `<div class="cta-buttons"><a href="/install/" class="btn-primary">Install the script</a><a href="https://forwardemail.net" class="btn-secondary" rel="noopener">Learn about Forward Email</a></div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'self'; style-src 'self'; img-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeHtml(page.description)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${page.url}">
<link rel="alternate" type="text/markdown" href="${mdHref}" title="${escapeHtml(page.h1)} (Markdown)">
<meta name="theme-color" content="${SITE.themeColor}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/images/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt">
<link rel="stylesheet" href="/css/style.min.css">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${escapeHtml(page.title)}">
<meta property="og:description" content="${escapeHtml(page.description)}">
<meta property="og:url" content="${page.url}">
<meta property="og:image" content="${SITE.url}${SITE.ogImage}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(SITE.ogImageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@fwdemail">
<meta name="twitter:title" content="${escapeHtml(page.title)}">
<meta name="twitter:description" content="${escapeHtml(page.description)}">
<meta name="twitter:image" content="${SITE.url}${SITE.ogImage}">
<meta name="twitter:image:alt" content="${escapeHtml(SITE.ogImageAlt)}">
<script type="application/ld+json">${jsonLd(page, pages)}</script>
</head>
<body>
${header(pages, page)}
<main id="main">
<div class="hero${isHome ? ' hero-home' : ''}">
  <div class="container hero-content">
    ${crumbs}
    <h1>${escapeHtml(page.h1)}</h1>
    <p class="lead">${inline(page.lead)}</p>
    ${cta}
  </div>
</div>
<article class="container content">
${page.md.html}
</article>
</main>
${footer(pages, page)}
</body>
</html>
`;
}

function notFound(pages) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'self'; style-src 'self'; img-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>Page not found | SSH Monitor</title>
<meta name="description" content="This page does not exist on sshmonitor.com. Use the links below to find the SSH Monitor install guide, FAQ and alert guides.">
<meta name="robots" content="noindex">
<meta name="theme-color" content="${SITE.themeColor}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/images/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/style.min.css">
</head>
<body>
${header(pages, null)}
<main id="main">
<div class="hero">
  <div class="container hero-content">
    <h1>Page not found</h1>
    <p class="lead">The page you asked for does not exist. It may have moved when the site was split into separate guides.</p>
  </div>
</div>
<div class="container content">
<h2>Where to go next</h2>
<ul>${pages.map((p) => `<li><a href="${p.urlPath}">${escapeHtml(p.h1)}</a></li>`).join('')}</ul>
</div>
</main>
${footer(pages, null)}
</body>
</html>
`;
}

function sitemap(pages) {
  const urls = pages.map((p) => `  <url>\n    <loc>${p.url}</loc>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function llms(pages) {
  const lines = [
    '# SSH Monitor',
    '',
    `> ${SITE.summary}`,
    '',
    'The script is ssh_monitor.sh. It runs from cron on Linux and reads only the lines added since the last run from /var/log/auth.log, /var/log/secure or the systemd journal (it saves an inode and byte offset, or a journal cursor). It counts failed attempts (Failed password/publickey/keyboard-interactive, PAM authentication failure, Invalid user, connections closed before login), counting each attempt once, and sends one HTML email when the count reaches FAILED_THRESHOLD, at most once per cooldown. Failed sends are retried on the next run. It does not block IP addresses and does not send an email for each successful login. Every page below is also available as Markdown at <page>/index.md.',
    '',
    '## Guides',
    ''
  ];
  for (const p of pages) lines.push(`- [${p.h1}](${p.url}index.md): ${p.llms || p.description}`);
  lines.push(
    '',
    '## Source',
    '',
    `- [ssh_monitor.sh](${SITE.url}/ssh_monitor.sh): The full Bash script.`,
    `- [GitHub repository](${SITE.repo}): Source for the script and this site.`,
    `- [Full text for LLMs](${SITE.url}/llms-full.txt): All guides in one Markdown file.`,
    '',
    '## Optional',
    '',
    '- [Forward Email](https://forwardemail.net): Open-source email service that delivers the alerts.',
    '- [Forward Email API reference](https://forwardemail.net/en/email-api): The POST /v1/emails endpoint the script calls.',
    ''
  );
  return lines.join('\n');
}

function pageMarkdown(p) {
  const body = cleanMarkdown(p.body).replace(/\]\(\//g, `](${SITE.url}/`);
  return `# ${p.h1}\n\n> ${plain(p.lead)}\n\nSource: ${p.url}\n\n${body}\n`;
}

function llmsFull(pages) {
  const parts = [`# SSH Monitor: full text\n\n> ${SITE.summary}\n`];
  for (const p of pages) parts.push(pageMarkdown(p).replace(/^# /, '## ').replace(/\n(#{2,3}) /g, '\n#$1 '));
  parts.push(`## Script source: ssh_monitor.sh\n\n\`\`\`bash\n${fs.readFileSync(path.join(ROOT, 'ssh_monitor.sh'), 'utf8').trim()}\n\`\`\`\n`);
  return parts.join('\n');
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim() + '\n';
}

// Cloudflare sits in front of GitHub Pages, and its Email Address Obfuscation
// rewrites addresses in served HTML into links that need a decoder script,
// which the CSP blocks. Wrap every address and mailto: link in the page body
// in the <!--email_off--> markers Cloudflare documents, so readers and
// crawlers see the real address. Cloudflare does not rewrite the <head>.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

function protectEmails(html) {
  const end = html.indexOf('</head>');
  const head = end === -1 ? '' : html.slice(0, end + 7);
  const body = end === -1 ? html : html.slice(end + 7);
  const token =
    /<!--email_off-->[\s\S]*?<!--\/email_off-->|<!--[\s\S]*?-->|<(script|style|textarea)\b[\s\S]*?<\/\1>|<a\b[^>]*href="mailto:[^"]*"[^>]*>[\s\S]*?<\/a>|<[^>]+>|[^<]+/gi;
  return (
    head +
    body.replace(token, (t) => {
      if (t.startsWith('<!--') || /^<(script|style|textarea)\b/i.test(t)) return t;
      if (/^<a\b/i.test(t)) return `<!--email_off-->${t}<!--/email_off-->`;
      if (t.startsWith('<')) return t;
      return t.replace(EMAIL_RE, (e) => `<!--email_off-->${e}<!--/email_off-->`);
    })
  );
}

function write(rel, content) {
  if (rel.endsWith('.html')) content = protectEmails(content);
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log('wrote', rel);
}

function build() {
  const pages = loadPages();
  for (const p of pages) {
    const dir = p.slug ? `${p.slug}/` : '';
    write(`${dir}index.html`, layout(p, pages));
    write(`${dir}index.md`, pageMarkdown(p));
  }

  write('404.html', notFound(pages));
  write('sitemap.xml', sitemap(pages));
  write('llms.txt', llms(pages));
  write('llms-full.txt', llmsFull(pages));
  write('css/style.min.css', minifyCss(fs.readFileSync(path.join(SRC, 'css', 'style.css'), 'utf8')));
}

build();
