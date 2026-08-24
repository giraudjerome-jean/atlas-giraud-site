#!/usr/bin/env python3
"""
compress_covers.py
------------------
Compresse les couvertures trop lourdes dans public/covers/.
- Seuil : 1 Mo (configurable)
- Redimensionne à max 2000px sur le grand côté
- JPEG quality 82, PNG → converti en JPEG
- Modifie les fichiers en place (conserve le même nom)

Usage:
  python3 scripts/compress_covers.py [--threshold 1.0] [--dry-run]
"""

import sys
import argparse
from pathlib import Path
from PIL import Image

COVERS_DIR   = Path("public/covers")
MAX_SIDE     = 2000
JPEG_QUALITY = 82

def human(size: int) -> str:
    return f"{size/1024/1024:.1f} Mo"

def compress(path: Path, dry_run: bool) -> tuple[int, int]:
    original_size = path.stat().st_size
    img = Image.open(path)

    # Redimensionne si trop grand
    w, h = img.size
    if max(w, h) > MAX_SIDE:
        ratio = MAX_SIDE / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

    # Convertit RGBA/P en RGB pour JPEG
    if img.mode in ("RGBA", "P", "LA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Toujours sauvegarde en JPEG (même les PNG)
    dest = path.with_suffix(".jpg") if path.suffix.lower() == ".png" else path

    if not dry_run:
        img.save(dest, "JPEG", quality=JPEG_QUALITY, optimize=True)
        if path.suffix.lower() == ".png" and dest != path:
            path.unlink()  # supprime l'original PNG

    new_size = dest.stat().st_size if (not dry_run and dest.exists()) else original_size // 3
    return original_size, new_size

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold", type=float, default=1.0, help="Seuil en Mo (défaut 1.0)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    threshold_bytes = int(args.threshold * 1024 * 1024)

    covers = sorted(COVERS_DIR.glob("*"))
    heavy  = [p for p in covers if p.is_file() and p.stat().st_size > threshold_bytes
              and p.suffix.lower() in (".jpg", ".jpeg", ".png")]

    if not heavy:
        print(f"Aucun fichier > {args.threshold} Mo trouvé.")
        return

    print(f"{'DRY RUN — ' if args.dry_run else ''}{len(heavy)} fichiers > {args.threshold} Mo\n")

    total_before = total_after = 0
    for p in heavy:
        try:
            before, after = compress(p, args.dry_run)
            saved = (1 - after / before) * 100
            dest_name = p.stem + ".jpg" if p.suffix.lower() == ".png" else p.name
            print(f"  {'~' if args.dry_run else '✓'}  {dest_name:<45} {human(before):>8} → {human(after):>8}  (-{saved:.0f}%)")
            total_before += before
            total_after  += after
        except Exception as e:
            print(f"  ❌ {p.name}: {e}")

    print(f"\nTotal : {human(total_before)} → {human(total_after)}  (-{(1 - total_after/total_before)*100:.0f}%)")
    if not args.dry_run:
        print("\nN'oublie pas de commiter :")
        print("  git add public/covers/ && git commit -m 'Compress heavy covers' && git push")

if __name__ == "__main__":
    main()
