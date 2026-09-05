# Maciek Codes

A small Jekyll blog and project list, published to https://maciek.codes with GitHub Pages.

## Local development

Install Ruby from `.ruby-version`, then run:

```sh
bundle install
bundle exec jekyll serve
```

Open http://localhost:4000. To check a production build:

```sh
JEKYLL_ENV=production bundle exec jekyll build
```

Posts live in `_posts/`. Their existing `/posts/:year/:month/:title.html` URLs are preserved. Edit `about.md` for the bio and `_data/projects.yml` for the project list.

## Design and performance

Local Liquid templates in `_layouts/` and `_includes/` render the site. Edit `assets/main.css` for the compact, text-first layout: white background, standard underlined links, serif body text, and monospace navigation and dates. All fonts are system fonts. There is no animation, client-side JavaScript, analytics, font download, or icon library. Each page loads one stylesheet and a small SVG favicon. Jekyll generates the RSS feed and SEO metadata at build time.

## Deployment

In the repository's **Settings → Pages**, use **GitHub Actions** as the source, set the custom domain to **maciek.codes**, and enable **Enforce HTTPS** when the certificate is ready. Push to `main` to build and deploy. Pull requests run the build without deploying.

The workflow uses Jekyll directly rather than the `github-pages` gem, so dependencies can stay current. `Gemfile.lock` pins the resolved versions. Dependabot checks gems and GitHub Actions monthly. To update gems manually:

```sh
bundle update --all
JEKYLL_ENV=production bundle exec jekyll build
```

## Domain setup: Namecheap + Cloudflare

`maciek.codes` uses Cloudflare nameservers, so edit DNS in **Cloudflare → maciek.codes → DNS → Records**, not Namecheap Advanced DNS.

| Type | Name | Target | Proxy status |
| --- | --- | --- | --- |
| A | @ | 185.199.108.153 | DNS only |
| A | @ | 185.199.109.153 | DNS only |
| A | @ | 185.199.110.153 | DNS only |
| A | @ | 185.199.111.153 | DNS only |
| CNAME | www | maciek-codes.github.io | DNS only |

Use Auto TTL. Replace conflicting A/AAAA/CNAME web records at `@` and `www`; keep email MX/TXT and unrelated records. No AAAA records are required for this minimal setup.

In **Namecheap → Domain List → Manage → Nameservers**, keep **Custom DNS** with `sima.ns.cloudflare.com` and `terin.ns.cloudflare.com`. No nameserver change is needed. Namecheap Advanced DNS records only apply if you switch DNS hosting to Namecheap; do not switch for this setup.

GitHub Pages handles the TLS certificate and redirects `www` to the configured apex domain. Allow up to 24 hours for DNS and HTTPS provisioning. If the certificate stays pending after DNS resolves correctly, remove and re-add the custom domain in GitHub Pages settings to restart provisioning, then enable HTTPS.

The original failure was Cloudflare HTTP 526: its proxy could not validate the origin certificate. DNS-only records let GitHub Pages serve the site and HTTPS directly. The existing `kumorek.com` site is separate and is not changed by this setup.

References: [GitHub custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [GitHub HTTPS troubleshooting](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https), [Cloudflare error 526](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-526/).
