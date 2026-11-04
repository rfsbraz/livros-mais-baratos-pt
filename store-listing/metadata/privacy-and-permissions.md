# Chrome Web Store privacy fields

Prepared for version 0.1.5 on 2026-11-03. These statements describe the packaged code. The account owner must confirm the dashboard certifications when submitting.

## Single purpose

Help users compare the price of the same book edition across selected bookshops, including automatic-by-default on-page cheaper-offer alerts and a local record of manual price checks.

## Permission justifications

### alarms

Schedule staggered checks only for saved books with enabled price targets, and restore the schedule after browser restarts.

### notifications

Show a system notification when a saved target is reached or a lower qualifying price is observed. The notice also remains in the extension.

### activeTab

Reads the current tab only after the user opens the extension, to identify the book ISBN and title for manual comparison.

### scripting

Reads the active page for manual comparison and registers the packaged book-detection script only on selected, authorized shop domains by default after installation, unless the user has disabled alerts. Also initializes detection in already-open authorized shop tabs.

### storage

Stores saved ISBNs and titles, locally observed manual/scheduled history, target prices, notification state, shipping rules/region, selected shop IDs and alert preferences in chrome.storage.local. No Chrome Sync or analytics.

### offscreen

Provides a bundled hidden DOM environment for parsing retrieved bookshop HTML with DOMParser while automatic comparisons run independently of the toolbar popup. Downloaded scripts are never executed.

### host_permissions

Fetches ISBN search and product pages directly from the selected shops over HTTPS and enables page detection on those same authorized domains. Access to the 26 specific shop origins is declared in host_permissions and requested at installation, enabling background comparisons without a separate setup step. No unrestricted host permission is requested.

## Remote code

Select: No, I am not using remote code.

All executable JavaScript is included in the extension. Bookshop HTML and JSON are parsed as data. Dynamic imports reference packaged extension modules, not third-party JavaScript.

## Data-type disclosures

Use these conservative disclosures rather than declaring that the extension handles no user data. Local processing must also be disclosed.

| Dashboard data type | Selection | Scope |
|---|---|---|
| Website content | Yes | Book-page content, ISBN, title, prices and availability are processed to match offers. HTML stays local. |
| Web history / browsing activity | Yes | Current supported shop URLs are processed for detection and routing. No general browsing-history log is collected or stored. |
| User activity | Yes | Selected shops, saved-book actions and comparison preferences are processed locally to provide the features. No clickstream, cursor or keystroke telemetry. |
| Personally identifiable information | No, within extension | No account, name or email collection in extension code. Emails voluntarily sent to support are handled separately as explained in the policy. |
| Health information | No | No collection for health purposes. |
| Financial/payment information | No | Public product prices are processed; payment details are not accessed. |
| Authentication information | No | No passwords or authentication cookies collected; extension requests omit session cookies. |
| Personal communications | No, within extension | The extension does not read email or messages. Support correspondence is external to the extension. |
| Location | No | No geolocation request or location profiling; shops receive the normal network IP address. |

## Data-use certifications

The extension does not sell or transfer user data for unrelated purposes, use it for creditworthiness/lending, or collect browsing data for advertising profiles. Disclosed affiliate offer clicks send the partner identifier to Wook, which may set cookies under its own policy. The ISBN/title are transmitted only to selected shops to perform the disclosed comparison feature. No developer backend receives page content or browsing data. Use the dashboard's corresponding limited-use certifications after reviewing the supplied privacy policy.

## Privacy URL

PENDING: host website/privacy.html at a public HTTPS URL and enter it in the dashboard. A file link or the private GitHub repository is not a public privacy-policy URL.

## Host access requested at installation

- Wook: https://www.wook.pt/*
- Bertrand: https://www.bertrand.pt/*
- Almedina: https://www.almedina.net/*
- Bookcover: https://bookcover.pt/*
- Continente: https://www.continente.pt/*
- Porto Editora: https://www.portoeditora.pt/*
- Lyvros / LeYa: https://www.lyvros.com/*
- Penguin Livros: https://penguinlivros.pt/*
- Presença: https://www.presenca.pt/*
- Guerra e Paz: https://www.guerraepaz.pt/*
- Gradiva: https://www.gradiva.pt/*
- Relógio d’Água: https://www.relogiodagua.pt/*
- Saída de Emergência: https://www.saidadeemergencia.com/*
- Quetzal: https://www.quetzaleditores.pt/*
- Antígona: https://antigona.pt/*
- Livraria Snob: https://www.livrariasnob.pt/*
- Kingpin Books: https://kingpinbooks.com/*
- mbooks: https://mbooks.pt/*
- Auchan: https://www.auchan.pt/*
- Blackwell’s: https://blackwells.co.uk/*
- Waterstones: https://www.waterstones.com/*
- IberLibro: https://www.iberlibro.com/*
- AbeBooks: https://www.abebooks.com/*
- El Corte Inglés PT: https://www.elcorteingles.pt/*
- Mundo Fantasma: https://mundofantasma.com/*
- Devir: https://editoradevir.pt/*

Sources: [Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [local data and website-content disclosure](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).
