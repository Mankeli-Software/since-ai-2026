"""Mirror the takomogolf.com home page into the demo landing (web/index.html + web/public/takomo/).

Takomo OK'd the copy for the hackathon demo (VISION §6.1, TASKS T6). The output is a static snapshot:

- Takomo's theme CSS/JS, images and hero video are copied locally. Images are fetched the way a browser
  asks for them (AVIF/WebP), with every srcset width, so the page renders pixel for pixel like the real one.
- Trackers, chat, consent, checkout, cart, popups and A/B tooling are stripped. The reviews carousel and
  the social gallery stay live third-party embeds, as on the real site; their content is never copied.
- Every link and form goes to the Fitter Studio. The page is noindex.
- Our Fitter Studio banner (src/features/landing/fitter-banner.html) sits between the header and the hero.

Run from the repo root, then commit index.html + public/takomo:  python3 -I web/scripts/mirror-takomo-home.py
"""

from __future__ import annotations

import hashlib
import html
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlsplit

WEB = Path(__file__).resolve().parent.parent
PUB = WEB / "public" / "takomo"
LANDING = WEB / "src" / "features" / "landing"
CACHE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(tempfile.gettempdir()) / "takomo-mirror-cache"
SITE = "https://takomogolf.com/"
STUDIO = "/studio.html"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
ACCEPT_IMG = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
EXT = {"image/avif": "avif", "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif",
       "image/svg+xml": "svg"}
THEME = "https://takomogolf.com/cdn/shop/t/2/assets/"

# Sections removed outright: redirects, cart drawer and marketing popups.
DROP_SECTIONS = ["client_side_redirects", "cart_drawer", "a_cart_popup", "a_welcome_back_popup", "a_quiz_popups"]
# Theme scripts kept: header, mega menu, sliders, tabs, scroll animations. Commerce scripts are dropped.
KEEP_JS = {
    "constants.js", "pubsub.js", "global.js", "A-global.js", "A-header.js", "A-header-sticky-nav.js",
    "animations.js", "details-disclosure.js", "details-modal.js", "component-tab-selector.js",
    "localization-form.js",
}
KEEP_INLINE = [
    "Shopify.locale", "Shopify.designMode", "window._template", "window.shopUrl", "const rules = [{",
    "getElementById('Banner-template--", "handicap_products_", "played_by_pros_",
    # Live reviews carousel and social gallery: loaded from their services as on the real site, never copied.
    "window.jdgmSettings", "window.jdgm=window.jdgm", "jdgm.docReady", "INF-1976", "jdgmPlayButtonSVG",
    "flowbox-js-embed", "function initFlowbox",
]
ASSET_RE = (
    r"(?:https:)?//(?:takomogolf\.com/cdn/shop/(?:files|products|videos|t/2/assets|t/2/compiled_assets)"
    r"|cdn\.shopify\.com/(?:static/images/flags|extensions/[^\"'\s]*?/judgeme-\d+/assets(?=/[^\"'\s]*\.css)))"
    r"/[^\"'\s,)]+"
)


def fetch(url: str, accept: str = "*/*") -> tuple[Path, str]:
    """Download once into CACHE; returns (body path, content type)."""
    key = hashlib.sha1(f"{accept}|{url}".encode()).hexdigest()
    body, meta = CACHE / key, CACHE / f"{key}.type"
    if not meta.exists():
        r = subprocess.run(
            ["curl", "-sfL", "-A", UA, "-H", f"Accept: {accept}", "-H", "Accept-Language: en-FI,en",
             "-o", str(body), "-w", "%{content_type}", url],
            capture_output=True, text=True,
        )
        if r.returncode:
            raise RuntimeError(f"download failed: {url}")
        meta.write_text(r.stdout.split(";")[0].strip())
    return body, meta.read_text()


def drop_element(src: str, start: int) -> str:
    tag = re.match(r"<(\w+)", src[start:]).group(1)
    depth = 0
    for m in re.finditer(rf"<(/?){tag}\b[^>]*>", src[start:], re.I):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return src[:start] + src[start + m.end():]
    raise ValueError(tag)


def script_filter(m: re.Match) -> str:
    attrs, body = m.group(1), m.group(2)
    src = re.search(r'src="([^"]+)"', attrs)
    if src:
        name = urlsplit(src.group(1)).path.rsplit("/", 1)[-1]
        keep = ("/cdn/shop/t/2/assets/" in src.group(1) and name in KEEP_JS) or (
            "/judgeme-" in src.group(1) and name in ("loader.js", "carousels.js"))
        return m.group(0) if keep else ""
    if "data-badge-data" in attrs:  # judge.me trust badge in the carousel header
        return m.group(0)
    if "application/json" in attrs or "application/ld+json" in attrs:
        return ""
    return m.group(0) if any(k in body for k in KEEP_INLINE) else ""


def link_filter(m: re.Match) -> str:
    tag = m.group(0)
    href = (re.search(r'href="([^"]+)"', tag) or [None, ""])[1]
    rel = (re.search(r'rel="([^"]+)"', tag) or [None, ""])[1]
    if "stylesheet" in rel:
        return tag if ("fonts.googleapis.com" in href or "/cdn/shop/t/2/" in href or "judgeme" in href) else ""
    if rel in ("icon", "shortcut icon", "apple-touch-icon", "canonical"):
        return tag
    if rel == "preload" and "/cdn/shop/t/2/" in href:
        return tag
    return tag if rel == "preconnect" and "fonts" in tag else ""


used: dict[str, str] = {}  # remote url -> local web path


def local_for(raw: str) -> str:
    u = html.unescape(raw)
    u = "https:" + u if u.startswith("//") else u
    parts = urlsplit(u)
    name = parts.path.rsplit("/", 1)[-1]
    stem, _, ext = name.rpartition(".")
    if "/static/images/flags/" in parts.path:
        loc = f"/takomo/flags/{name}"
    elif "/videos/" in parts.path:
        loc = f"/takomo/video/{name}"
    elif "/cdn/shop/t/2/" in parts.path:
        loc = f"/takomo/theme/{name}"
    elif "/extensions/" in parts.path:
        loc = f"/takomo/ext/{name}"
    else:
        q = parse_qs(parts.query)
        suffix = "".join(f"-{k}{q[p][0]}" for k, p in (("w", "width"), ("h", "height"), ("c", "crop")) if p in q)
        ext = EXT.get(fetch(u, ACCEPT_IMG)[1], ext)
        loc = f"/takomo/img/{stem}{suffix}.{ext}"
    used[u] = loc
    return loc


def srcset_fix(m: re.Match) -> str:
    val = m.group(2)
    if "takomogolf.com/cdn" not in val and "cdn.shopify.com/static" not in val:
        return m.group(0)
    entries = []
    for e in (e.strip() for e in html.unescape(val).split(",")):
        if e:
            url, *desc = e.split()
            entries.append(" ".join([local_for(url), *desc]))
    return f'{m.group(1)}="{", ".join(entries)}"'


def href_fix(m: re.Match) -> str:
    v = m.group(2)
    return m.group(0) if v.startswith(("#", "/takomo/", "javascript")) else f'{m.group(1)}"{STUDIO}"'


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    s = fetch(SITE, "text/html")[0].read_text()

    for name in DROP_SECTIONS:
        m = re.search(rf'<(?:div|section)\b[^>]*id="shopify-section-[^"]*__{name}[^"]*"', s)
        if m:
            s = drop_element(s, m.start())

    s = re.sub(r"<script\b([^>]*)>(.*?)</script>", script_filter, s, flags=re.S)
    s = re.sub(r"<noscript>.*?</noscript>", "", s, flags=re.S)
    # Style of the product-options modal (its app is gone); it has a syntax error Vite's CSS minifier rejects.
    s = re.sub(r"<style\b[^>]*>(?:(?!</style>).)*#modalMWS.*?</style>", "", s, flags=re.S)
    s = re.sub(r"<link\b[^>]*>", link_filter, s)
    s = re.sub(r'<meta\s+(?:name|property)="(?:shopify-[^"]*|google-site-verification|facebook-domain-verification)"'
               r"[^>]*>", "", s)
    s = s.replace("<head>", '<head>\n    <meta name="robots" content="noindex, nofollow">', 1)

    # Assets. The hero video keeps its mp4; the HLS source is dropped.
    s = re.sub(r'<source data-src="[^"]*\.m3u8[^"]*" type="application/x-mpegURL">', "", s)
    s = re.sub(r'((?:image)?srcset)="([^"]*)"', srcset_fix, s)
    s = re.sub(ASSET_RE, lambda m: local_for(m.group(0)), s)

    # Every link and form goes to the studio.
    s = re.sub(r'(<a\b[^>]*?\shref=)"([^"]*)"', href_fix, s)
    s = re.sub(r'(<form\b[^>]*?\saction=)"[^"]*"', rf'\1"{STUDIO}"', s)
    s = re.sub(r'(<form\b[^>]*?\smethod=)"post"', r'\1"get"', s, flags=re.I)

    # No consent banner on the demo: start the social gallery without cookies, as the site does on "reject".
    s = s.replace('<div id="js-flowbox-flow"', '<script>document.addEventListener("DOMContentLoaded",'
                  '()=>window.initFlowbox&&initFlowbox(false))</script><div id="js-flowbox-flow"', 1)
    s = s.replace('<main id="MainContent"', (LANDING / "fitter-banner.html").read_text() + '<main id="MainContent"', 1)
    s = s.replace("</head>", '    <link rel="stylesheet" href="/src/features/landing/fitter-banner.css">\n'
                  '    <script type="module" src="/src/features/landing/main.ts"></script>\n</head>', 1)
    s = re.sub(r"\n\s*\n+", "\n", s)

    if PUB.exists():
        shutil.rmtree(PUB)
    (PUB / "inline").mkdir(parents=True)

    # Theme <style> blocks become static files linked in place (same cascade order): Vite would minify them
    # with lightningcss, which rejects selectors browsers accept. <style> inside inline SVG stays put.
    out, last, n = [], 0, 0
    for m in re.finditer(r"<style\b([^>]*)>(.*?)</style>", s, flags=re.S):
        before = s[: m.start()]
        if before.count("<svg") > before.count("</svg"):
            continue
        name = f"{n:03d}-{hashlib.sha1(m.group(2).encode()).hexdigest()[:8]}.css"
        (PUB / "inline" / name).write_text(m.group(2))
        media = re.search(r'media="[^"]*"', m.group(1))
        out += [s[last : m.start()], f'<link rel="stylesheet" href="/takomo/inline/{name}"'
                f'{" " + media.group(0) if media else ""}>']
        last, n = m.end(), n + 1
    (WEB / "index.html").write_text("".join(out) + s[last:])

    def copy(item: tuple[str, str]) -> None:
        url, loc = item
        dest = WEB / "public" / loc.lstrip("/")
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(fetch(url, ACCEPT_IMG if loc.startswith("/takomo/img/") else "*/*")[0], dest)

    with ThreadPoolExecutor(16) as pool:
        list(pool.map(copy, sorted(used.items())))

    # Theme CSS: drop source maps, localise absolute and relative url() references.
    for css in (PUB / "theme").glob("*.css"):
        t = re.sub(r"/\*# sourceMappingURL=[^*]*\*/", "", css.read_text())
        for rel in set(re.findall(r"url\(\./([^)\"']+)\)", t)):
            copy((urljoin(THEME, rel), f"/takomo/theme/{rel}"))
        css.write_text(re.sub(ASSET_RE, lambda m: local_for(m.group(0)), t))
    print(f"index.html + {len(used)} assets -> {PUB}")


if __name__ == "__main__":
    main()
