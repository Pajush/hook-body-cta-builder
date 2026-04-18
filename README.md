# Hook Body CTA Builder

Public app: http://hook-body-cta-builder.vercel.app/

Made by Pavla Duranova:
https://www.linkedin.com/in/pavla-duranova/

Support / Buy Me a Coffee:
https://buymeacoffee.com/pajushinkad

Feel free to use :)

## CZ

Webová aplikace pro skládání video kombinací ve stylu Hook + Body + CTA.

### Co umí

1. Nahrání klipů do sekcí Hook / Body / CTA.
2. Automatické generování všech kombinací (včetně 2 ze 3 sekcí).
3. Volitelné přidání hudby, fade-out, zachování nebo nahrazení původního audia.
4. Nastavení výstupního rozlišení, FPS a auto-rotate při nesouladu orientace.
5. Náhled, stažení jednotlivých výstupů, nebo hromadně jako ZIP.
6. Přepínač jazyka Česky / English.

### Výkon a limity

1. Celé zpracování běží lokálně v prohlížeči přes ffmpeg.wasm.
2. Nic se neposílá na server kvůli renderu.
3. Doporučení pro plynulý provoz: přibližně do 20 videí, ideálně každé do 1 minuty.
4. Orientační nároky na paměť: cca 1.5-5 GB RAM podle délky, rozlišení a počtu renderů.
5. Při větších dávkách pomůže zavřít další náročné karty/aplikace.

### Lokální spuštění

```bash
npm install
npm run dev
```

Produkční build:

```bash
npm run build
```

## EN

Web app for building video combinations in a Hook + Body + CTA workflow.

### Features

1. Upload clips into Hook / Body / CTA sections.
2. Auto-generate all combinations (including 2 out of 3 sections).
3. Optional background music, fade-out, keep or replace original audio.
4. Output settings for resolution, FPS, and auto-rotate on orientation mismatch.
5. Preview and download individual outputs or all outputs as ZIP.
6. Language switcher: Czech / English.

### Performance notes

1. Processing runs entirely in your browser using ffmpeg.wasm.
2. No render uploads are sent to any server.
3. Recommended for smooth usage: around 20 videos, ideally up to 1 minute each.
4. Typical memory usage: around 1.5-5 GB RAM depending on duration, resolution, and render count.
5. For bigger batches, close other heavy browser tabs/apps.

### Local run

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```
