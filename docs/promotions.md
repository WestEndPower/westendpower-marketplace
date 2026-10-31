# Promotions browsing

`promotions.html` uses the approved Shop by Product category cards. Current, Expiring Soon, Coming Soon, 0.00% Offers, 1st Responder and Fleet Programs filter the category, subcategory and power links. The links retain `promo=current|expiring|coming|zero|responders|fleet` in Marketplace; the same URL state works on both Shop routes.

Switching promotion type from any shopping route returns to the selected promotion's category cards, without the previous category, manufacturer, search or specification filters. Switching type on the Promotions page also clears its search box. Choosing a category then opens matching equipment with the manufacturer sidebar available for further narrowing.

Current includes customer rebates and dated sale prices only. Expiring Soon includes only active sales and customer rebates ending in the current Eastern calendar month. Coming Soon includes future sales and customer rebates and labels their start/end dates without applying future amounts to today's purchase prices. Financing remains on price tags and in payment options but never qualifies a category or SKU for these promotion filters. Undated MAP fallback and dealer-only amounts do not qualify as promotions. A product can match several offer periods. Category links retain the selected promotion view, and the manufacturer sidebar continues to narrow those matching results.

0.00% Offers requires a verified per-SKU flag from `POST /marketplace-promotion-programs` with `{brandId, finance:true}`. The API uses the same protected eligibility function as the price tags for one standalone unit, including purchase limits, bulletin group, fee caps and minimum profit; it returns only SKU and a boolean flag. Public group flags alone cannot qualify a product. Only active, public, displayed zero-APR programs qualify. Future, expired, excluded and nonzero-APR programs do not qualify. It is a separate view; sales and rebates alone do not qualify a product for it.

The combined catalog includes public finance tables for all published brands. Existing per-brand CSV files remain the fallback. Normal workbook export and Marketplace sync continue to update this data; no separate promotion entry is needed.

First Responder and Fleet availability comes from `POST /marketplace-promotion-programs` on the configurator API. Its response contains only brand, SKU and boolean availability flags. The API checks the private workbook discount fields and active program rules. The UI uses the existing Build & Buy eligibility copy and a See store for details notice. Browsing is not verification or a program selection; quote creation still checks customer confirmation, fleet points and financing compatibility.

Deploy the companion configurator API change before publishing this Marketplace change. If the program lookup fails, the affected views show an availability error; unverified financing SKUs stay excluded; they do not silently claim there are no eligible products. Current, Expiring Soon and Coming Soon remain available.

Validation: `node --test tests/*.test.cjs tests/*.test.mjs`; companion API: `node --test tests/*.test.mjs`. Browser QA uses local workbook-derived availability fixtures until the new endpoint is deployed. No quotes, orders, payments or live eligibility confirmations are created by QA.
