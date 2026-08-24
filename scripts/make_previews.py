#!/usr/bin/env python3
"""
make_previews.py
----------------
Pour chaque PDF dans public/docs/, génère une version aperçu
contenant seulement les N premières pages (défaut : 9).

Le fichier original n'est pas modifié.
Le preview est sauvegardé dans public/docs/previews/<nom>.pdf

Usage:
  python3 scripts/make_previews.py [--pages 9] [--force]

  --pages N  : nombre de pages à garder (défaut 9)
  --force    : recrée les previews même s'ils existent déjà
"""

import sys
import argparse
from pathlib import Path
from pypdf import PdfReader, PdfWriter

DOCS_DIR     = Path("public/docs")
PREVIEWS_DIR = DOCS_DIR / "previews"

def make_preview(src: Path, dest: Path, n_pages: int):
    reader = PdfReader(src)
    total  = len(reader.pages)
    pages  = min(n_pages, total)

    writer = PdfWriter()
    for i in range(pages):
        writer.add_page(reader.pages[i])

    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "wb") as f:
        writer.write(f)

    size_src  = src.stat().st_size  / 1024 / 1024
    size_dest = dest.stat().st_size / 1024 / 1024
    return total, pages, size_src, size_dest

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=int, default=9)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    pdfs = [p for p in DOCS_DIR.glob("*.pdf") if p.parent == DOCS_DIR]

    if not pdfs:
        print(f"Aucun PDF trouvé dans {DOCS_DIR}")
        sys.exit(0)

    print(f"Génération des aperçus ({args.pages} pages max) pour {len(pdfs)} fichier(s)…\n")

    for src in sorted(pdfs):
        dest = PREVIEWS_DIR / src.name
        if dest.exists() and not args.force:
            print(f"  ⏭  {src.name} — aperçu déjà existant (--force pour recréer)")
            continue

        try:
            total, pages, size_src, size_dest = make_preview(src, dest, args.pages)
            saved = (1 - size_dest / size_src) * 100 if size_src > 0 else 0
            print(f"  ✓  {src.name}  ({total} pages → {pages})  {size_src:.1f} Mo → {size_dest:.1f} Mo  (-{saved:.0f}%)")
        except Exception as e:
            print(f"  ❌ {src.name} : {e}")

    print(f"\nAperçus dans : {PREVIEWS_DIR}/")
    print("Pour utiliser les previews dans l'atlas, mets pdf_url = /docs/previews/<nom>.pdf en base.")

if __name__ == "__main__":
    main()
