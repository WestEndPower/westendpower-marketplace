"""Build card-sized WebP copies without modifying original product images.

Install Pillow, then run from any directory:
  python scripts/build-responsive-images.py
Add source paths to data/responsive-image-sources.json when expanding coverage.
"""
import hashlib
import json
import re
import math
from pathlib import Path
from PIL import Image, ImageOps, ImageChops

ROOT = Path(__file__).resolve().parents[1]


def card_frame(image):
    # Mirror the existing card fitter: remove only white/transparent margins
    # when every corner is blank, then retain a 4% safety border.
    rgba = image.convert("RGBA")
    blank = lambda p: p[3] < 16 or min(p[:3]) > 238
    w, h = rgba.size
    if not all(blank(rgba.getpixel(point)) for point in [(0, 0), (w-1, 0), (0, h-1), (w-1, h-1)]):
        return image
    red, green, blue, alpha = rgba.split()
    dark = ImageChops.darker(ImageChops.darker(red, green), blue).point(lambda p: 255 if p <= 238 else 0)
    visible = ImageChops.multiply(dark, alpha.point(lambda p: 255 if p >= 16 else 0))
    box = visible.getbbox()
    if not box:
        return image
    left, top, right, bottom = box
    margin = max(2, math.ceil(max(right-left, bottom-top) * .04))
    box = (max(0, left-margin), max(0, top-margin), min(w, right+margin), min(h, bottom+margin))
    if (box[2]-box[0])*(box[3]-box[1]) > w*h*.9:
        return image
    return image.crop(box)



def build():
    manifest = {}
    for source in json.loads((ROOT / "data/responsive-image-sources.json").read_text()):
        path = (ROOT / source).resolve()
        if not path.is_relative_to(ROOT / "brands") or not path.is_file():
            raise ValueError("Missing or unsupported source: " + source)
        digest = hashlib.sha256(path.read_bytes() + b"wep-card-v1-crop-q82").hexdigest()[:16]
        with Image.open(path) as original:
            image = ImageOps.exif_transpose(original).convert("RGBA" if "A" in original.getbands() or "transparency" in original.info else "RGB")
            image = card_frame(image)
            width, height = image.size
            variants = []
            for size in sorted({min(320, width), min(640, width)}):
                resized = image.resize((size, max(1, round(height * size / width))), Image.Resampling.LANCZOS)
                target = path.parent / "responsive" / f"{path.stem}-{digest}-{size}.webp"
                target.parent.mkdir(exist_ok=True)
                resized.save(target, "WEBP", quality=82, method=6)
                variants.append({"src": target.relative_to(ROOT).as_posix(), "width": size})
            manifest[source] = {"width": width, "height": height, "variants": variants}
    payload = json.dumps(manifest, separators=(",", ":"), sort_keys=True)
    runtime = ROOT / "universal/responsive-images.js"
    code = runtime.read_text()
    before, rest = code.split("// BEGIN GENERATED MANIFEST\n", 1)
    _, after = rest.split("// END GENERATED MANIFEST", 1)
    runtime.write_text(before + "// BEGIN GENERATED MANIFEST\n const images=" + payload + ";\n// END GENERATED MANIFEST" + after)
    safe_payload = payload.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    seed = '<script type="application/json" id="wep-responsive-images">' + safe_payload + '</script>'
    for filename in ["marketplace.html", "shop-by-product.html", "shop-by-brand.html"]:
        page = ROOT / filename
        html = re.sub(r'<script type="application/json" id="wep-responsive-images">.*?</script>', "", page.read_text(), flags=re.S)
        page.write_text(html.replace('</head>', seed + '</head>', 1))
    print(f"Built responsive copies for {len(manifest)} images. Originals unchanged.")


if __name__ == "__main__":
    build()
