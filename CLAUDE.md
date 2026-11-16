# Higher Administration and IT revision: rules for AI sessions

Free Higher Administration and IT revision app for Scottish pupils, served at https://nat5scotland.com/higher-admin/ by the nat5scotland Cloudflare Worker, which Hark maintains. The Worker proxies this repo's GitHub Pages site and caches it for about 5 minutes.

## Never break

- **Pushing to `main` is live** on nat5scotland.com within about 5 minutes. Work on a branch, commit, and let Caroline push or merge.
- **Facts come only from the current Qualifications Scotland (formerly SQA) course specification**, specimen papers and course reports. Several courses changed in June 2026, so check the course page's "Changes to the course assessment" notice before writing any exam fact (marks, timings, question types). Never guess a fact.
- **The audience is under 18.** No prices, selling or shop links in questions, explanations or social posts. The page may carry the Pencil and Thistle Etsy checklist card and Amazon revision-guide picks in their marked slots; anything else that sells needs Caroline's OK.
- **Release together:** when `assets/` changes, bump `?v=N` on every asset link in `index.html` and the same `?v=N` in the `ASSETS` list and `CACHE_NAME` in `sw.js`, or pupils keep the old files from their offline cache.

## Working on the app

- `index.html`, `assets/styles.css`, `assets/app.js` and `assets/data.js`. No build step.
- `assets/app.js` is this subject's own engine; other subjects have their own copies.
- The question format is described in the comment at the top of `assets/data.js`. Add new questions at the end of their topic list and don't reorder existing ones, so saved progress and worksheets stay valid.
- Typed-answer marking is this engine's own (it differs from the shared N5 engine). Check every new typed answer in the browser before committing.
- Keep the navy nat5scotland top bar and its links. New pages and route changes go through Hark (Worker routes, sitemap and home-page links).
- Test at phone width (390px) as well as desktop. Most pupils use phones.

## Writing

- Follow `~/home-repo/docs/standards.md`: British English and the Stop Slop rules.
- Plain, encouraging and exact. Write for a 15 to 17-year-old revising on a phone.
