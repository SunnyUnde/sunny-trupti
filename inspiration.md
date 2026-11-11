# Inspiration: wedding registry and wedding website ideas

Ideas gathered on 2026-11-11 from eight sources on Indian wedding gifting and
registry platforms, compared against what this site already has.

**What the site has today:** cinematic intro, live countdown, save-the-date,
one event (time "To be announced"), Google and Apple/Outlook calendar buttons,
venue directions, Marathi/English toggle, dark mode, engagement memory page.

**Legend for "Static?":** whether GitHub Pages alone can do it.
- **Yes**: pure HTML/CSS/JS content.
- **Link**: link out to a third-party service; nothing to build here.
- **No**: needs shared state, payments, or a backend.

## 1. Guest information (wedding website)

| Idea | Sources | Static? | Notes |
|---|---|---|---|
| Per-function details (time, venue, dress code for each event) | WW Inc42, WW YS | Yes | Site has one event, time still TBA |
| Travel and stay info for outstation guests | WW YS | Yes | |
| "Our story" section | WW Inc42 | Yes | |
| Gift preferences stated on the site | WW Inc42 | Yes | Only if gifting is wanted at all |
| Countdown | WW Inc42 | Have it | |
| Mobile-first, simple enough for older guests | Kiki 2026 | Have it | Worth re-checking with an elderly relative |

## 2. RSVP and guest interaction

| Idea | Sources | Static? | Notes |
|---|---|---|---|
| RSVP | WW Inc42, WW YS | Link | Google Form or Tally, or a backend |
| Guest blessing or note to the couple | Hazlnut, Gifaa | Link | Hazlnut delivers it privately with the gift |
| Personalised messages to guests | WW Inc42 | No | Couple-side tool, not a site feature |
| Community space for guests (messages, images) | WW Inc42 | No | WhatsApp group already does this |

## 3. Gifting: cash and shagun

| Idea | Sources | Static? | Notes |
|---|---|---|---|
| Cash fund via the couple's own UPI ID / QR | Kiki (gokiki.in), Gifaa | Yes | Money goes straight to the couple's bank; guest pays in own UPI app |
| Goal-based funds (honeymoon, new home, education) | Kiki, Gifaa, Hazlnut, WW YS ("holidays") | Yes, as labels | No tracking without a backend |
| Fund progress bar ("82% filled") | Hazlnut | No | Needs a record of who paid |
| Preset amounts (Rs 500 / 1,000 / 2,500) or custom | Hazlnut | No | Gateway feature |
| Card, Apple Pay, international cards (NRI guests) | Hazlnut | No | Gateway; Hazlnut charges a flat 2%, payout T+2 to an Indian bank |
| Charity fund instead of gifts | Hazlnut, Gifaa, Kiki 2026, WW Inc42, WW YS | Link | WW Inc42: 22% of couples added one, avg Rs 5,400 per guest |
| Note sent along with the money | Gifaa, Hazlnut | No | |

## 4. Gifting: item registry

| Idea | Sources | Static? | Notes |
|---|---|---|---|
| Add products from any online store by pasting a link | Kiki, Gifaa, Hazlnut, WW YS, WW Inc42 | Link | Use Kiki or Hazlnut rather than build |
| Reserve / mark as bought, so no duplicate gifts | Hazlnut, Gifaa, Kiki | No | Needs shared state |
| Group gifting, chip in toward an expensive item | Hazlnut, Gifaa, Kiki 2026, WW Inc42, WW YS | No | |
| Gift cards | Kiki YS, Kiki 2026, WW YS | Link | Kiki marks part of this "Coming Soon" |
| Experiences (dinner, weekend away, classes, spa) | Kiki, Gifaa, Kiki 2026 | Link | |
| Couple's caption on each gift | Hazlnut | Link | e.g. "Manish claims this will get him cooking finally..." |
| Cover image, title, welcome message on the registry | Hazlnut, Kiki | Link | |
| Delivery to couple's address, or hand over in person | Kiki, Hazlnut, Gifaa, WW YS | Link | WW YS: delivered "when and where they want" |
| Spread of price points, Rs 500 to Rs 50,000+ | Gifaa | Advice | So every guest finds something |
| Guests browse without an account | Kiki 2026, Gifaa, Hazlnut | Link | Hazlnut needs phone OTP / Google / email to reserve or pay |
| Registry is private, link-only, not searchable | Kiki | Link | See privacy note below |
| AI-written gift descriptions | Hazlnut (testimonial only) | Link | |

## 5. Sharing the invitation and registry

| Idea | Sources | Static? | Notes |
|---|---|---|---|
| One link shared on WhatsApp, SMS, email | Kiki, Gifaa, Hazlnut, Kiki 2026 | Have it | The site URL already is this link |
| Registry link embedded in the e-invite | Gifaa, Kiki 2026, Hazlnut | Yes | One button |
| QR code on the printed card | None of the eight | Yes | Not in any source; our own idea |

## 6. On the day

| Idea | Sources | Static? | Notes |
|---|---|---|---|
| Live announcements and updates | WW YS | Partly | An editable banner; changing it needs a commit |
| Guests share live location | WW YS | No | WhatsApp does this |
| Shared real-time photo album ("Vowed" app) | WW Inc42 | Link | Google Photos shared album; avoids photos scattered across WhatsApp |

## 7. After the wedding

| Idea | Sources | Static? | Notes |
|---|---|---|---|
| Track who gave what | Gifaa, Hazlnut (dashboard) | No | Couple-side |
| Thank-you notes, with couple's photos | Gifaa, WW Inc42 | No | WW YS listed it as a 2019 future plan |
| Turn the site into a "memory" page, like engagement | (our pattern) | Yes | Already done for the engagement |

## 8. Products, not site features

Listed for completeness; nothing to build.
- Digital, video and e-invites; custom monogram (WW YS, WW Inc42)
- Return-gift / favour catalogue for guests (WW YS)
- Checklist and budget planner (WW Inc42, WW YS)
- Vendor marketplace: planners, designers, florists (WW Inc42, WW YS)
- Planner logistics app, "Guested" (WW Inc42, WW YS)
- Secret Santa tool and budget gift guides (Kiki on X)

## Counterpoints

- **Public UPI ID.** Kiki and Hazlnut keep registries link-only and unsearchable.
  This site is public and listed in `sitemap.xml`. A UPI QR here is readable by
  anyone, including senders of fake "payment request" scams. If shagun goes
  online, put it on a page left out of the sitemap, marked `noindex`, and linked
  only from the WhatsApp invite.
- **UPI excludes NRI guests.** Only a gateway product (Hazlnut, 2% fee) covers
  international cards.
- **Building a registry is the wrong job for this repo.** Every registry feature
  needs shared state. Linking to Kiki or Hazlnut gets all of them with one button.
- **These are registry products; this site is an invitation.** The ideas that fit
  an invitation are per-function details, travel info, RSVP and the photo album.
  Gifting is optional, and some families find it out of place on a Maharashtrian
  invitation.

## Suggested order

1. Per-function details and travel info (static, pure content).
2. RSVP via a form link.
3. One link to a hidden registry or shagun page, only if gifting is wanted.

## Sources

| Short name | What | URL | How read |
|---|---|---|---|
| Kiki YS | Kiki company profile, YourStory | https://yourstory.com/companies/kiki-wedding--baby-gift-registry | Search snippets only (HTTP 403); reads like Kiki's own copy |
| Kiki (gokiki.in) | Kiki on Crunchbase | https://www.crunchbase.com/organization/kiki-2bf0 | Snippets only (HTTP 403); features read from https://gokiki.in instead |
| Kiki on X | @gokikiin | https://x.com/gokikiin | Read; bio plus 3 posts, nothing concrete on weddings |
| Hazlnut | Hazlnut site | https://hazlnut.in/ , /faqs , /demo-wishlist , /explore | Read directly |
| Gifaa | Gifaa blog (6 posts) and registry landing page | https://www.gifaa.in/blog/ , https://www.gifaa.in/wedding-gift-registry | Read directly; Gifaa's own marketing |
| WW Inc42 | Wedding Wishlist, Inc42 (2 articles) | https://inc42.com/startups/wedding-wishlist-startup-is-bringing-tech-upgrade-in-indian-weddings , https://inc42.com/features/how-wedding-wishlist-is-carving-a-tech-driven-niche-in-indias-50-bn-wedding-market | Read; the second is sponsored (BrandLabs) |
| WW YS | Wedding Wishlist, YourStory 2019 | https://yourstory.com/2019/06/chennai-startup-wedding-wishlist-kanika-subbiah | Read via Wayback Machine (live page HTTP 403) |
| Kiki 2026 | "Wedding Registry Platforms in India (2026)" and "Best Wedding Gift Registry in India (2026)" | https://www.gokiki.in/blog/wedding-registry-platforms-in-india-2026/ , https://www.gokiki.in/blog/best-wedding-gift-registry-in-india-2026/ | Read; Kiki's own marketing |

**Conflicts between sources:**
- Wedding Wishlist founding year: 2016 (Inc42), 2015 (YourStory), 2012 (Kiki, a competitor).
- Kiki 2026 says Wedding Wishlist has pivoted to planning and MyThofa is defunct. Competitor claims, unverified.
- Hazlnut's homepage FAQ offers a free direct-UPI option; its newer Help Centre says all cash contributions carry 2%. The direct option may be discontinued.
