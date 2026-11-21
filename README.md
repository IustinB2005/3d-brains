# 3D Brains

Aplicație web pentru cei care vând printuri 3D: comenzi, costul real per print, profit, stoc de filament.
Interfața e în engleză, ca s-o poată folosi oricine.

## Ce face

- **Comenzi pe etape**: Quote → Queued → Printing → Done → Delivered (+ Cancelled), cu dată limită, client și marcaj de plătit/neplătit.
- **Costul real per print**: filament (la gram), curent (W × lei/kWh), uzura imprimantei (preț ÷ ore de viață + mentenanță), manoperă, buffer pentru printuri eșuate și costuri extra. Primești și un **preț sugerat** după adaosul tău.
- **Printables și MakerWorld**: lipești linkul unui model și se completează titlul, sursa și imaginea de previzualizare (imaginea vine prin funcția `link-preview`).
- **Import din fișier feliat**: tragi în pagină un `.gcode.3mf` din Bambu Studio / OrcaSlicer sau un `.gcode` din PrusaSlicer / Orca / Cura. Timpul de print, gramele per culoare și thumbnail-ul se completează singure, iar culorile sunt potrivite automat cu bobinele tale. Dacă fișierul vine de pe MakerWorld, se adaugă și linkul modelului.
- **Stoc de filament**: gramele se scad automat când o comandă trece pe Done și se pun înapoi dacă o readuci la o etapă anterioară. Bobinele aproape goale apar pe dashboard.
- **Dashboard**: venit, profit, marjă, ore de print, kg de filament, sume neîncasate, grafic pe 12 luni și de unde vin modelele.
- **Export** CSV (comenzi) și JSON (backup complet).
- **Conturi separate**: fiecare utilizator își vede doar datele lui (Row Level Security în Postgres).
- Merge pe telefon și are dark mode automat.

## Arhitectură (100% gratuită)

| Ce | Serviciu | Plan gratuit |
|---|---|---|
| Site static (HTML/CSS/JS) | **Cloudflare Pages** | bandwidth nelimitat, domeniu propriu, HTTPS |
| Conturi + bază de date | **Supabase** | 500 MB DB, 50.000 utilizatori activi/lună |
| Preview pentru linkuri | Supabase Edge Function | 500.000 apeluri/lună |

Aplicația nu are niciun pas de build: sunt doar fișiere statice, fără framework. Librăriile (`supabase-js`, `fflate`) sunt incluse în `vendor/`, deci nu depinde de niciun CDN.

**Limitarea planului gratuit:** Supabase pune proiectul pe pauză după 7 zile fără nicio activitate. Îl repornești cu un click din dashboard-ul Supabase. Cât timp îl folosești măcar o dată pe săptămână, nu se întâmplă.

## Mod demo

Cât timp `src/config.js` e gol, aplicația rulează în **mod demo**: conturile și datele rămân doar în browser (localStorage). E util ca s-o încerci imediat. Ca să rulezi local:

```bash
cd 3dbrains
python3 -m http.server 8080
# deschide http://localhost:8080
```

## Publicare pe 3dbrains.ro: pas cu pas

### 1. Supabase (conturi + bază de date)

1. Îți faci cont pe [supabase.com](https://supabase.com) → **New project** (regiunea: Frankfurt, `eu-central-1`).
2. **SQL Editor → New query**: lipești tot conținutul din `supabase/schema.sql` → **Run**.
3. **Project Settings → API**: copiezi **Project URL** și cheia **anon public** în `src/config.js`:
   ```js
   export const SUPABASE_URL = 'https://xxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...';
   ```
   Cheia `anon` poate fi publică fără probleme, pentru că datele sunt protejate de RLS. **Nu pune niciodată cheia `service_role` în cod.**
4. **Authentication → URL Configuration**:
   - Site URL: `https://3dbrains.ro`
   - Redirect URLs: `https://3dbrains.ro/**` și `http://localhost:8080/**`
5. **E-mailuri de confirmare**: serverul de e-mail inclus în Supabase trimite doar câteva e-mailuri pe oră. Ai două variante:
   - fie conectezi un SMTP gratuit (Brevo: 300 e-mailuri/zi, sau Resend: 3.000/lună) din **Authentication → Emails → SMTP Settings**;
   - fie, la început, dezactivezi **Confirm email** din **Authentication → Providers → Email**.
6. (Opțional, pentru imaginile de preview la linkuri) Instalezi [Supabase CLI](https://supabase.com/docs/guides/cli) și rulezi:
   ```bash
   supabase login
   supabase link --project-ref <id-proiect>
   supabase functions deploy link-preview
   ```
   Fără funcția asta, titlul tot se completează din link, doar imaginea lipsește. MakerWorld blochează uneori roboții, iar în cazul ăsta rămâne doar titlul din link. Pentru MakerWorld, importul din `.3mf` dă oricum cele mai complete date.

### 2. GitHub

Creezi un repository (poate fi privat), de exemplu `3dbrains`, și urci codul:

```bash
git remote add origin https://github.com/<user>/3dbrains.git
git push -u origin main
```

### 3. Cloudflare Pages (găzduire)

1. Cont gratuit pe [cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages → Connect to Git** → alegi repository-ul.
2. Framework preset: **None**. Build command: *(gol)*. Build output directory: `/`.
3. **Save and Deploy**. Primești o adresă de forma `3dbrains.pages.dev`.
4. Orice `git push` ulterior republică site-ul automat.

### 4. Domeniul 3dbrains.ro

1. În Cloudflare: **Add a domain** → `3dbrains.ro` → planul **Free**. Cloudflare îți dă 2 nameservere (de forma `xxx.ns.cloudflare.com`).
2. La firma de la care ai cumpărat domeniul (ROTLD / registrar), înlocuiești nameserverele cu cele două de la Cloudflare. Propagarea durează de la câteva minute până la 24 de ore.
3. În proiectul Pages: **Custom domains → Set up a domain** → `3dbrains.ro` (și `www.3dbrains.ro`). Cloudflare creează singur înregistrările DNS și certificatul HTTPS.

Gata: `https://3dbrains.ro` e live, iar oricine își poate face cont.

## Structura proiectului

```
index.html              punctul de intrare
styles.css              tot designul (light + dark)
src/config.js           cheile Supabase (gol = mod demo)
src/store.js            stratul de date: localStorage (demo) sau Supabase
src/calc.js             calcule: costuri, preț, statistici
src/integrations.js     Printables/MakerWorld + parsare .3mf/.gcode
src/app.js              stare, salvare comenzi, sincronizare stoc, date demo
src/views/*.js          paginile (landing, auth, overview, orders, ...)
supabase/schema.sql     tabelele + politicile RLS
supabase/functions/     funcția link-preview
vendor/                 supabase-js 2.45.4, fflate 0.8.2
```

## Idei pentru mai târziu

- Pagină publică de ofertă / catalog per utilizator (link de trimis clienților).
- Upload de poze în Supabase Storage.
- Facturi PDF.
- Integrare cu imprimantele Bambu (status live prin MQTT pe rețeaua locală).

## SEO

- `index.html` conține titlul, descrierea, `canonical`, datele Open Graph / Twitter și date structurate JSON-LD (`WebSite`, `Organization`, `SoftwareApplication`). Datele structurate îi spun lui Google că „3D Brains” este numele site-ului.
- Pagina de prezentare e pre-generată direct în `index.html`, așa că motoarele de căutare văd textul complet fără să ruleze JavaScript.
- `robots.txt`, `sitemap.xml`, `site.webmanifest`, iconițele și `assets/og-image.png` (imaginea care apare când cineva distribuie linkul).
- După ce modifici pagina de prezentare, regenerezi aceste fișiere cu:
  ```bash
  python3 -m http.server 8080 &
  node scripts/prerender.cjs
  ```
