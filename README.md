# refillka-flow

Static GitHub Pages site for the **refillka** platform (ReCirca Management Corp):

- **`index.html`** — the product-flow field notes: a screen-by-screen, annotated walkthrough of
  how the platform works (public site → admin console → store owner app → operations app →
  SDG impact reporting → architecture). All people shown in mockups are illustrative.
- **`upload.html`** — the **data intake** page for authorized staff. It commits submissions
  (details + attachments) to the **private** [`refillka-uploads`](https://github.com/Sreenivas-Sadhu-Prabhakara/refillka-uploads)
  repository via the GitHub Contents API using the visitor's own fine-grained token.

## How upload access control works (important)

GitHub Pages is static hosting — there is no server here to run a login. The enforcement is
GitHub itself:

1. Submissions are written to the **private** `refillka-uploads` repo.
2. Only accounts with **write access** to that repo can submit. Everyone else gets refused by
   the GitHub API, no matter what they do to this page.
3. To authorize someone (keep it to 1–2 people): `refillka-uploads` → Settings → Collaborators →
   add their GitHub account with **Write** role. They then create a fine-grained PAT scoped to
   only that repo with **Contents: Read & write**, and paste it on the intake page.

The intake page is intentionally unlinked from the main site navigation and marked `noindex`.
Note that the *page itself* is public (this repo must be public for free GitHub Pages) — the
privacy boundary is the upload destination, not the form.

## Local preview

```bash
python3 -m http.server 8080   # then http://localhost:8080
```

No build step, no dependencies — plain HTML/CSS/JS.
