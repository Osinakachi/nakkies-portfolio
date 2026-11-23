# Nakkie's Portfolio

Static site ported from a Webflow template (Oxyco), plus new pages and a Cloudflare form worker.
Everything lives in this one folder (no subfolders), so it can be uploaded to GitHub in the browser.
No build step is needed to deploy: Cloudflare Pages serves the files as they are.

## What the files are
- `index.html`: Home (edit by hand)
- `work.html`, `about.html`, `contact.html`, `blog.html`, `shop.html`, `404.html`: generated pages
- `project-*.html`, `post-*.html`: generated project and blog post pages
- `projects.json`, `posts.json`, `products.json`: the content for those pages
- `build.py`: regenerates the generated pages from the JSON files
- `_worker.js`: Cloudflare worker that receives the forms (`/api/contact`, `/api/subscribe`)
- `pages.css`: styles for the new pages. The long `nakkies-portfolio-...css` file is the Webflow design.
- `webflow.*.js`, `jquery-*.js`, `webfont.js`: Webflow's runtime, which runs the animations. Do not edit these.
- `site.js`: form submission and the blog filter
- images (`.jpg`, `.png`, `.svg`): all site images

## Editing content
1. Edit `projects.json`, `posts.json` or `products.json`.
2. Run `python3 build.py` in this folder.
3. Upload the changed files to GitHub. Cloudflare redeploys automatically.
To add a project, add an entry to `projects.json` and add its image file to the folder.
The navbar and footer are copied from `index.html` into every generated page, so change them there first, then re-run the build.

## Deploy on Cloudflare Pages
1. Workers & Pages > Create > Pages > Connect to Git, then pick the repo.
2. Build command: none. Build output directory: `/`.

## Forms
`_worker.js` emails you through [Resend](https://resend.com) (free tier).
1. Create a Resend account with osinakachi.anyachebelu@gmail.com and create an API key.
2. In Cloudflare: your Pages project > Settings > Variables and Secrets. Add the secret `RESEND_API_KEY`.
   Optional variables: `TO_EMAIL` (default is your Gmail) and `FROM_EMAIL`
   (default `Portfolio <onboarding@resend.dev>`, which can only deliver to the email you signed up to Resend with).
3. Redeploy, then submit the contact form on the live site to test it.
Newsletter signups arrive as notification emails; connect a mailing-list service when you want a real list.

## Placeholders to replace
- Project names, project descriptions and blog post bodies.
- Shop products and prices are demo content. The shop has no cart or payments; "Enquire" goes to the contact page.
- Social links point to the networks' home pages. Put your profile URLs in `index.html` and in `build.py` (contact page), then re-run the build.
- Favicon and share image still use Webflow defaults.

## Password-protected case studies (Moneris Go portal)
- Pages: `moneris.html` (overview) and `moneris-*.html` (four case studies). Content lives in `moneris.json`; `unlock.html` is the password page.
- `_worker.js` blocks every `/moneris*` URL unless the visitor has signed in. The pages are never served without the cookie.
- Set the password in Cloudflare: your project > Settings > Variables and Secrets > add secret `CASE_STUDY_PASSWORD` (value: the password). It is not case-sensitive. Changing it signs everyone out.
- `wrangler.jsonc` must list `"run_worker_first": ["/api/*", "/moneris*"]` (already set in the file included here).
- Purple highlighted text on those pages is SAMPLE content. `fill-in-list.md` lists every sample. Replace each `[[P5 ... || sample]]` in `moneris.json` with real text, then run `python3 build.py`.
- Grey dashed boxes are image slots; each names the Figma frame to export.
- Create a file named `.assetsignore` on GitHub with the contents of `assetsignore.txt` so the JSON content and worker are not served publicly.

## Notes
- Do not add `data-wf-status` or `data-wf-domain` back to the `<html>` tag; Webflow's script would show its badge again.
- Animations are tied to element IDs (`data-w-id`). Keep those attributes when you edit Home.
