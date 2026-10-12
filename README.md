# Cowboy Dorms – Channel Manager (runs on GitHub only)

A private app at **app.cowboydorms.com** for running every dorm-bed booking by hand, without a paid channel manager and without any server or database company. **GitHub is the only thing it needs.**

- **One calendar for every channel.** Record bookings from Booking.com, Agoda, Hostelworld, MakeMyTrip, Goibibo, WhatsApp, walk-ins and the website, and see free beds bed-by-bed.
- **No overbooking.** The app won't save a booking that doesn't fit, and it stays correct when two people save at the same moment.
- **OTA update checklist.** After every booking, change, cancellation, no-show or early check-out, each of the *other* OTAs gets a task. Each task shows how many beds to set free on each date, with CLOSE where a date is full. Tick a task once you've updated that extranet.
- **Today screen.** Shows arrivals, check-outs, who's in the house, payments still to collect, and free beds for the next 14 days.
- **Bills.** Creates a non-GST bill for any booking. Use Print → Save as PDF to send it on WhatsApp.
- **Reports (owner only).** Occupancy, revenue, OTA commission and what you keep per channel, plus a CSV export for Excel.
- **Logins.** Each person signs in with a user ID and password. *Owner* sees everything. *Staff* see bookings, the calendar and OTA updates, but not Reports or Settings, and can't delete bookings.

## How it works
| What | Where |
|---|---|
| The app (pages people open) | Repo **cowboydorms-app** (public), published by GitHub Pages at app.cowboydorms.com |
| Bookings, dorms, OTA tasks | One file, `db.json`, in repo **cowboydorms-data**, which is **PRIVATE**. Every save is a commit, so you can see who changed what and when, and undo anything. |
| Logins | `public/users.json` in the app repo. It holds only *encrypted* copies of the GitHub key, each locked with that person's password. |

---

## Setup (one time, about 15 minutes)

### Step 1 – Create the two repos
Sign in to github.com as **tourwithanand**, then:
1. **+ → New repository**:
   - Name: `cowboydorms-data`
   - Choose **Private**.
   - Tick **Add a README file**.
   - Click **Create**.
2. **+ → New repository** again:
   - Name: `cowboydorms-app`
   - Choose **Public**. This is needed for free GitHub Pages, and it's safe: no guest data or passwords live here.
   - Click **Create**.

### Step 2 – Upload the app
1. Unzip `cowboy-dorms-app.zip`.
2. In `cowboydorms-app`, click **uploading an existing file** and drag in **everything** from the unzipped folder, including the `.github` folder. Click **Commit changes**.
   - If the `.github` folder didn't upload: choose **Add file → Create new file**, type the name `.github/workflows/deploy.yml`, paste in the contents of that file, and commit.

### Step 3 – Switch on GitHub Pages
1. In `cowboydorms-app`, go to **Settings → Pages → Source** and choose **GitHub Actions**.
2. Go to **Actions → Deploy app to GitHub Pages → Run workflow**. Wait about 1 minute for the green tick.
3. Go back to **Settings → Pages → Custom domain**. It should show `app.cowboydorms.com`; if not, type it in and click Save.

### Step 4 – GoDaddy DNS
Go to **My Products → cowboydorms.com → DNS → Add New Record** and enter:

| Type  | Name  | Value                     | TTL    |
|-------|-------|---------------------------|--------|
| CNAME | `app` | `tourwithanand.github.io` | 1 hour |

Click Save. Your main website isn't affected. After 10–30 minutes, go back to GitHub **Settings → Pages** and tick **Enforce HTTPS**.

### Step 5 – Make the app's GitHub key
1. Go to github.com → your photo → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Fill it in:
   - **Token name:** `cowboy-dorms-app`
   - **Expiration:** the longest offered.
   - **Repository access:** *Only select repositories* → `cowboydorms-app` and `cowboydorms-data`
   - **Permissions → Repository permissions → Contents:** **Read and write**
3. Click **Generate token** and copy it. It starts with `github_pat_`. Don't save it anywhere else.

### Step 6 – First login
1. Open **app.cowboydorms.com**. It shows **First-time setup**.
2. Paste the key and click **Check**. The two repo names fill in by themselves.
3. Choose the owner user ID (`ali`) and a password of at least 8 characters, then click **Finish setup & sign in**.
4. Go to **Settings → Dorms & beds → Add dorm** and add each dorm with its bed count, for example Purple Dorm, 8 beds, prefix P.
5. Go to **Settings → Channels / OTAs** and check each OTA's commission % and extranet link.
6. Go to **Settings → Users → Add staff login** and give each staff member a user ID and password.
7. On your phone, open the site and choose **Add to Home Screen**. It then opens like an app.

---

## Daily use
1. **A booking arrives** (OTA, WhatsApp, walk-in): tap **+ Booking**, enter the guest, dates, beds, amount and where it came from, then save.
2. **OTA** tab: a red number means some OTAs need updating. Tap **Extranet**, set the free beds shown (CLOSE = 0 or stop-sell), then tick the task.
3. **Today**: use **Check in** / **Check out**. Checking a guest out early frees their remaining nights and adds OTA tasks for those dates.
4. **Cancel / No-show**: open the booking and choose the action. The beds are freed and OTA tasks are added.

## Looking after logins
- **New staff:** go to Settings → Users → Add staff login. They can sign in straight away.
- **Staff leaves:** click **Switch off**. Their access ends immediately.
- **Forgotten password:** click **Reset password** (owner). Anyone can change their own password from **Password** in the sidebar, or **More → Change my password** on a phone.
- **When the GitHub key expires**, or if you think someone copied it: make a new key (Step 5) and paste it in **Settings → GitHub → Replace the GitHub key**. Then reset each staff password.

Note: staff limits (no Reports or Settings) are enforced inside the app. Staff logins carry an encrypted copy of the same GitHub key, so only give logins to people you trust.

## Try it first
Open **app.cowboydorms.com/?demo** to try the app with sample data. Nothing is saved. Sign in as `ali` / `demo` (owner) or `staff` / `demo`.

## Files
- `src/engine.js` – the booking rules: free beds, no double booking, OTA tasks and reports.
- `src/github.js` – reading and saving on GitHub, plus logins.
- `src/config.js` – the property name, address, phone, default ₹600 rate and check-in/out times shown on bills.
- `src/pages/…` – the screens.
- `.github/workflows/deploy.yml` – publishes the app to GitHub Pages on every upload.
