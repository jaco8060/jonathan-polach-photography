# How to edit your website

You never need to touch code. You'll use two things:

- **The editor** at <https://app.pagescms.org> (sign in with GitHub). This is where you change photos, text, prices and colors.
- **Cloudflare** at <https://dash.cloudflare.com> (only to check that the site published, roll back, or connect a domain).

When you click **Save** in the editor, your site rebuilds itself and goes live in about a minute.

---

## 1. Add a new gallery

1. Open the editor and click **Galleries**, then **Add an entry**.
2. Type a **Gallery name** (for example "Smith Wedding") and a short **Description**.
3. Under **Photos**, click **Add** for each photo, then choose a photo (or upload one from your computer).
4. For each photo, fill in **Description for screen readers** (say what's in it, e.g. "Bride laughing with her bridesmaids") and, if you like, a **Caption**.
5. Set **Position**: 1 shows first, 2 second, and so on. Choose a **Cover photo** (or leave blank to use the first photo).
6. Click **Save**. Wait about a minute, then refresh your site.

## 2. Add, remove or reorder photos

1. **Galleries** → open the gallery.
2. **Add:** click **Add** under Photos and pick or upload a photo. **Remove:** use the delete button beside a photo. **Reorder:** drag a photo up or down.
3. Click **Save**.

Removing a photo from a gallery doesn't delete the file. To delete the file too, open **Photos** in the editor's left menu.

## 3. Edit captions and descriptions

Open the gallery, change the **Caption** or **Description for screen readers** next to the photo, and click **Save**.

## 4. Change the home page photos, colors, fonts or layout

1. Click **Site settings**.
2. **Home page photos:** pick 1 to 5 wide photos. Choose "Slow fade" or "One photo".
3. **Look:** choose Warm editorial, Light gallery or Dark gallery.
4. **Custom colors (optional):** type a code like `#8c4a32` into Accent to change the highlight color. Leave a box empty to use the Look you chose. If a color is hard to read, the site quietly uses the Look's color instead and the build tells you.
5. **Fonts**, **Gallery layout** and **Space between photos** are drop-down menus.
6. Click **Save**.

## 5. Edit About, Services and your contact details

- **About page** and **Services and prices** are in the left menu. Type in the box and click **Save**.
- Your **email, phone, location and Instagram** are in **Site settings**. The email shown there is also where the "mailto" fallback sends messages.

## 6. Publish

Clicking **Save** is publishing. Wait about a minute. To check, see section 9.

## 7. Roll back (undo a mistake)

1. Go to <https://dash.cloudflare.com> → **Workers & Pages** → your project.
2. Open **Deployments**.
3. Find an earlier deployment that was good, click the **⋯** menu next to it, and choose **Rollback to this deployment**.

Your visitors immediately see the older version. (Your photos and text in the editor are unchanged. If you want those back too, fix them in the editor and save.)

## 8. Connect your own domain (like yourname.com)

1. Buy a domain (Cloudflare Registrar is simplest, because the domain is then already on Cloudflare).
2. In Cloudflare: **Workers & Pages** → your project → **Custom domains** → **Set up a custom domain**.
3. Type your domain and follow the prompts. Cloudflare adds the records for you if the domain is on Cloudflare.
4. In the editor, **Site settings** → **Website address**, type the full address, like `https://www.yourname.com`, and Save.

## 9. If the site didn't update

1. Cloudflare → **Workers & Pages** → your project → **Deployments**.
2. Look at the top deployment. **Success** means it's live (try a hard refresh: Cmd+Shift+R on Mac, Ctrl+F5 on Windows).
3. **Failed** means a file has a mistake. Click it and read the **Build log**. The message at the bottom says which file and what's wrong in plain English (for example, a missing quote). **Your old site keeps running meanwhile**, so nothing is broken for visitors. Fix the file in the editor and Save again.
4. Messages that begin with `!` are warnings: the site still published, but something was skipped (like a photo that couldn't be found).

---

## Exporting photos correctly

Cloudflare allows a maximum of **25 MB per file**, and the build stops with a message naming any photo over that limit. The site makes the smaller web sizes itself, so you only need one good file per photo.

**Lightroom (Classic or cloud):** File → Export, then:

- Format **JPEG**, Quality **82**
- Color space **sRGB**
- Resize to fit: **Long edge, 2400 pixels**
- Metadata: **Copyright only** (this removes your location from the file)
- Sharpening: **Screen, Standard**

Save this as a preset ("Website") so you only set it up once.

**From a phone:** Share → choose the original or the largest size, and make sure **Location** is turned off in the share options.

File names with spaces or capital letters are fine.

## Where photos go

Upload photos in the editor under **Photos**. A gallery then refers to them by name. The sample photos called `sample-01.jpg` ... `sample-10.jpg` are placeholders: delete them from **Photos** once your own are in.

---

## Private client galleries (optional)

These are pages like `yourname.com/clients/smith-2026/` where a client can see their photos. They only work safely once you've done **both** of these steps. Until then, leave the switch off.

1. You need your own domain (section 8).
2. In Cloudflare: **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**. Set the domain to your site and the path to `clients/*`. Add a policy that **allows** specific email addresses (yours, plus each client's). Visitors type their email and get a one-time code. This is free for up to 50 people.
3. In the editor: **Site settings** → turn on **Private client galleries**, and Save.
4. **Client galleries** → **Add an entry**. The **file name is the web address**, so use something hard to guess. Upload their photos under **Client photos (private)**.

Never put client photos in the normal Photos folder.

## Contact form setup (one time)

The recommended setting is **Email with spam check**. This takes about 10 minutes, uses free accounts, and only needs doing once:

1. **Turnstile** (Cloudflare dashboard → **Turnstile** → **Add widget**, add your site address). Copy the **Site key** into **Site settings → Contact form → Turnstile site key**. Keep the **Secret key** for step 3.
2. **Resend** (<https://resend.com>, free). Create an **API key**. While you have no domain, Resend can only deliver to the email you signed up with, which is fine for your own enquiries.
3. In Cloudflare: your project → **Settings** → **Variables and Secrets** → add (choose **Encrypt** for the first two):
   - `TURNSTILE_SECRET` = your Turnstile secret key
   - `RESEND_API_KEY` = your Resend API key
   - `CONTACT_TO` = the email that should receive enquiries
4. Save, then redeploy: **Deployments** → latest → **Retry deployment**. Send yourself a test message.

Until the Turnstile site key is entered, the form simply opens the visitor's email app addressed to you, so you never lose an enquiry.

## Analytics

Cloudflare → your project → **Metrics** → **Enable Web Analytics**. It's free, doesn't use cookies, and needs no cookie banner.

---

## Example of every file

You normally use the editor, but these are the files it saves (in the GitHub repository, under `content/`).

**content/site.json**
```json
{
  "name": "Jonathan Polach Photography",
  "tagline": "Weddings and celebrations, photographed honestly.",
  "email": "hello@example.com",
  "preset": "warm-editorial",
  "colors": { "background": "", "text": "", "accent": "#8c4a32" },
  "fonts": "elegant-serif",
  "layout": "justified",
  "gutter": "normal",
  "hero": { "mode": "crossfade", "images": ["sample-01.jpg", "sample-04.jpg"] },
  "contact": { "method": "function", "turnstileSiteKey": "" },
  "clients": { "enabled": false }
}
```

**content/galleries/weddings.yml**
```yaml
title: Weddings
description: Quiet moments and big celebrations.
order: 1
cover: sample-03.jpg
photos:
  - file: sample-01.jpg
    alt: Warm golden light behind a smiling couple
    caption: Golden hour, first look
```

**content/about.md** (same format for **services.md**)
```markdown
---
title: About
photo: sample-02.jpg
photoAlt: Portrait of Jonathan
---
Hello, I'm Jonathan...
```

**content/clients/smith-2026.yml**
```yaml
title: Smith Wedding
description: Your photos are ready.
photos:
  - file: smith-001.jpg
    alt: First dance
```
