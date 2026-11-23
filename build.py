#!/usr/bin/env python3
"""
Generates the pages other than Home: work, about, contact, blog, shop, 404,
project-<slug>.html and post-<slug>.html.

Run from this folder:   python3 build.py

The navbar, footer and scripts are copied from index.html, so
change them there first, then re-run this script to update every page.
Content comes from projects.json, posts.json and products.json. Home (index.html) is edited by hand.
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EMAIL = "osinakachi.anyachebelu@gmail.com"
SITE = "Nakkie A."
E = html.escape


def load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


# ------------------------------------------------------------------ partials
home = (ROOT / "index.html").read_text(encoding="utf-8")

head_html = home[: home.index("<body")]
navbar = home[home.index('<div data-animation="default" class="navbar w-nav"'):]
navbar = navbar[: re.search(r'<div[^>]*class="hero"', navbar).start()]
footer = home[re.search(r'<div class="footer">', home).start():]
footer = footer[: footer.index("<script src=")]
scripts = home[home.index("<script src=", home.index('<div class="footer">')):]  # script tags + closing </body></html>

# on inner pages the logo is not the "current" page
navbar = navbar.replace(' aria-current="page"', "").replace(" w--current", "")


def head(title, description):
    h = head_html
    h = re.sub(r"<title>.*?</title>", f"<title>{E(title)}</title>", h)
    h = re.sub(r'(<meta content=")[^"]*(" property="og:title">)', rf"\g<1>{E(title)}\2", h)
    h = re.sub(r'(<meta content=")[^"]*(" name="twitter:title">)', rf"\g<1>{E(title)}\2", h)
    h = re.sub(r'(<meta content=")[^"]*(" name="description">)', rf"\g<1>{E(description)}\2", h)
    h = re.sub(r'(<meta content=")[^"]*(" property="og:description">)', rf"\g<1>{E(description)}\2", h)
    h = re.sub(r'(<meta content=")[^"]*(" name="twitter:description">)', rf"\g<1>{E(description)}\2", h)
    return h


def page(slug_class, title, description, content):
    return (
        head(title, description)
        + f'<body class="nk-page-{slug_class}"><div>{navbar}'
        + f'<main class="nk-main">{content}</main></div>{footer}{scripts}'
    )


def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    print("wrote", path)


def img(name):
    return f"/{name}"


# ------------------------------------------------------------------ data
pd = load("projects.json")
projects, tags = pd["projects"], pd["tags"]
posts_data = load("posts.json")
posts, post_body = posts_data["posts"], posts_data["placeholder_body"]
products = load("products.json")["products"]
tag_line = ", ".join(tags)

# ------------------------------------------------------------------ work
cards = "".join(
    f'<li><a class="nk-project-link" href="/project-{p["slug"]}">'
    f'<div class="nk-project-img"><img src="{img(p["image"])}" alt="{E(p["title"])} cover" loading="lazy"></div>'
    f'<h2 class="nk-project-name">{E(p["title"])}</h2>'
    f'<p class="nk-project-tags">{E(tag_line)}</p></a></li>'
    for p in projects
)
write(
    "work.html",
    page(
        "work",
        f"Work | {SITE}",
        "Selected work in product design, UI/UX, branding, visual design and art direction.",
        '<h1 class="nk-title">Work</h1>'
        '<p class="nk-lede">Product design, UI/UX, branding, visual design and art direction.</p>'
        f'<ul class="nk-projects">{cards}</ul>',
    ),
)

# project detail pages
for i, p in enumerate(projects):
    nxt = projects[(i + 1) % len(projects)]
    chips = "".join(f"<li>{E(t)}</li>" for t in tags)
    write(
        f"project-{p['slug']}.html",
        page(
            "project",
            f"{p['title']} | {SITE}",
            p["description"],
            '<a class="nk-back" href="/work">Back to work</a>'
            f'<h1 class="nk-title is-small">{E(p["title"])}</h1>'
            f'<ul class="nk-tags">{chips}</ul>'
            f'<div class="nk-detail-img"><img src="{img(p["image"])}" alt="{E(p["title"])} cover"></div>'
            f'<div class="nk-prose"><p>{E(p["description"])}</p></div>'
            f'<a class="nk-next" href="/project-{nxt["slug"]}"><small>Next project</small>'
            f'<strong>{E(nxt["title"])}</strong></a>',
        ),
    )

# ------------------------------------------------------------------ about
disciplines = "".join(f"<li>{E(t)}</li>" for t in tags[:5])
write(
    "about.html",
    page(
        "about",
        f"About | {SITE}",
        "Art director and designer with 8+ years of experience, based in Canada.",
        '<h1 class="nk-title">About</h1>'
        '<div class="nk-about-hero">'
        f'<div class="about-image-border nk-portrait"><img src="{img("67eb5067b095ffb7f4e632be_IMG_6031.JPGk.jpg")}" '
        'alt="Portrait of Nakkie A." class="about-image"></div>'
        '<p class="nk-statement"><span class="pop">Art Director &amp; Designer</span> with 8+ years of expertise, '
        'creating beautiful and functional designs with a keen eye for detail and dedication to the latest '
        "trends and technologies.</p></div>"
        '<h2 class="nk-section-title">What I do</h2>'
        f'<ul class="nk-list">{disciplines}</ul>'
        '<a class="nk-cta" href="/contact"><small>Have a project in mind?</small>'
        '<span class="purple-gradient large-heading upper-case">Let&rsquo;s talk</span></a>',
    ),
)

# ------------------------------------------------------------------ contact
HP = (
    '<input type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" '
    'style="position:absolute;left:-9999px;opacity:0;height:0;width:0">'
)
write(
    "contact.html",
    page(
        "contact",
        f"Contact | {SITE}",
        "Get in touch about design projects. Based in Canada.",
        '<h1 class="nk-title">Contact</h1>'
        '<div class="nk-contact-grid">'
        "<div>"
        f'<a class="purple-gradient nk-mail" href="mailto:{EMAIL}">{EMAIL}</a>'
        '<p class="nk-info-note">Based in Canada</p>'
        '<ul class="nk-links">'
        '<li><a href="https://www.linkedin.com/" target="_blank" rel="noopener">LinkedIn</a></li>'
        '<li><a href="https://www.instagram.com/" target="_blank" rel="noopener">Instagram</a></li>'
        '<li><a href="https://twitter.com/" target="_blank" rel="noopener">Twitter</a></li>'
        "</ul></div>"
        '<div class="w-form">'
        '<form class="nk-form" method="post" action="/api/contact" data-form="contact" aria-label="Contact form">'
        f"{HP}"
        '<label class="nk-field"><span>Name</span><input type="text" name="name" maxlength="100" autocomplete="name"></label>'
        '<label class="nk-field"><span>Email</span><input type="email" name="email" maxlength="254" autocomplete="email" required></label>'
        '<label class="nk-field"><span>Message</span><textarea name="message" maxlength="5000" required></textarea></label>'
        '<button type="submit" class="nk-btn" data-wait="Sending...">Send message</button></form>'
        '<div class="w-form-done" role="status"><div>Thanks! Your message has been sent.</div></div>'
        f'<div class="w-form-fail" role="alert"><div>Something went wrong. Please try again or email {EMAIL}.</div></div>'
        "</div></div>",
    ),
)

# ------------------------------------------------------------------ blog
cats = sorted({p["category"] for p in posts})
chips = '<button type="button" class="nk-chip" data-filter="all" aria-pressed="true">All</button>' + "".join(
    f'<button type="button" class="nk-chip" data-filter="{E(c)}" aria-pressed="false">{E(c)}</button>' for c in cats
)
rows = "".join(
    f'<li data-category="{E(p["category"])}"><a class="nk-post" href="/post-{p["slug"]}">'
    f'<span class="nk-post-time">{p["minutes"]} min read</span><h2>{E(p["title"])}</h2>'
    f'<span class="nk-post-cat">{E(p["category"])}</span></a></li>'
    for p in posts
)
write(
    "blog.html",
    page(
        "blog",
        f"Blog | {SITE}",
        "Notes on UX, design and building better websites.",
        '<h1 class="nk-title">Blog</h1>'
        f'<div class="nk-chips" role="group" aria-label="Filter by category">{chips}</div>'
        f'<ul class="nk-posts">{rows}</ul>',
    ),
)

for p in posts:
    body = "".join(f"<p>{E(t)}</p>" for t in post_body)
    write(
        f"post-{p['slug']}.html",
        page(
            "post",
            f"{p['title']} | {SITE}",
            p["title"],
            '<a class="nk-back" href="/blog">Back to blog</a>'
            f'<h1 class="nk-title is-small">{E(p["title"])}</h1>'
            f'<ul class="nk-tags"><li>{E(p["category"])}</li><li>{p["minutes"]} min read</li></ul>'
            f'<div class="nk-prose" style="margin-top:2.4em">{body}</div>',
        ),
    )

# ------------------------------------------------------------------ shop
items = "".join(
    f'<li><div class="nk-product-img"><img src="{img(p["image"])}" alt="{E(p["name"])}" loading="lazy"></div>'
    f'<h2>{E(p["name"])}</h2><p class="nk-price">{E(p["price"])}</p>'
    f'<a class="nk-btn" href="/contact">Enquire</a></li>'
    for p in products
)
write(
    "shop.html",
    page(
        "shop",
        f"Shop | {SITE}",
        "Design resources and prints.",
        '<h1 class="nk-title">Shop</h1>'
        '<p class="nk-lede">Design resources and prints. To buy something, send an enquiry.</p>'
        f'<ul class="nk-products">{items}</ul>',
    ),
)

# ------------------------------------------------------------------ 404
write(
    "404.html",
    page(
        "404",
        f"Page not found | {SITE}",
        "This page does not exist.",
        '<div class="nk-404"><span class="purple-gradient">404</span>'
        "<p>This page doesn&rsquo;t exist or has moved.</p>"
        '<a class="nk-btn" href="/">Back to home</a></div>',
    ),
)
