# Promotions browsing

`promotions.html` uses the approved Shop by Product category cards. Current, Expiring Soon, Coming Soon, 1st Responder and Fleet Programs filter the category, subcategory and power links. The links retain `promo=current|expiring|coming|responders|fleet` in Marketplace; the same URL state works on both Shop routes.

Current includes customer rebates, dated sale prices and eligible public 0% financing. Expiring Soon includes only active offers ending in the current Eastern calendar month. Coming Soon includes future offers and labels their start/end dates without applying future amounts to today's purchase prices. Undated MAP fallback and dealer-only amounts do not qualify as promotions. A product can match several offer periods.

The combined catalog includes public finance tables for all published brands. Existing per-brand CSV files remain the fallback. Normal workbook export and Marketplace sync continue to update this data; no separate promotion entry is needed.

First Responder and Fleet availability comes from `POST /marketplace-promotion-programs` on the configurator API. Its response contains only brand, SKU and boolean availability flags. The API checks the private workbook discount fields and active program rules. The UI uses the existing Build & Buy eligibility copy and a See store for details notice. Browsing is not verification or a program selection; quote creation still checks customer confirmation, fleet points and financing compatibility.

Deploy the companion configurator API change before publishing this Marketplace change. If the program lookup fails, the special program views show an availability error; they do not silently claim there are no eligible products. Current, Expiring Soon and Coming Soon remain available.

Validation: `node --test tests/*.test.cjs tests/*.test.mjs`; companion API: `node --test tests/*.test.mjs`. Browser QA uses local workbook-derived availability fixtures until the new endpoint is deployed. No quotes, orders, payments or live eligibility confirmations are created by QA.
