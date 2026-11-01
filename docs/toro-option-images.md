# Toro attachment, accessory and part photos

Toro option CSV exports can omit ImageURL. Put photos in the Toro configurator's `images/products` folder, named for their exact SKU (for example `78690.jpg` or `STB13567B.jpg`). Toro option sync now discovers these photos, copies them into Marketplace's `brands/toro/images/products` folder and writes matching public ImageURL fields. The combined catalog is rebuilt by the normal publishing workflow.

Supported extensions are jpg, jpeg, png, webp, gif and svg. Filename matching accepts case differences and preserves the actual filename for hosting. Keep one photo per SKU or supply ImageURL explicitly to select a filename. Explicit HTTP image URLs stay unchanged. Missing explicitly linked local files stop the sync; rows without an image or matching file retain the placeholder.

Image updates use the option sync's existing backup and rollback behavior. A standalone Toro publication uploads the Toro site's assets; Marketplace must also run its Toro sync/publish workflow to receive them.
