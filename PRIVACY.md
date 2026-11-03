# Privacy

The extension reads the current page only after the user opens it. Page HTML is processed locally to find a book ISBN and title; it is not uploaded. On comparison, the ISBN and, when needed, the book title are sent directly to the selected bookshops. They receive normal connection information, including IP address, and apply their own privacy policies. Requests omit session cookies. Only the selected automatic stores are requested as optional host permissions; manual links open ordinary store pages and do not grant extension access. Those pages use the browser's normal website privacy settings.

Saved titles, ISBNs and observed prices remain in `chrome.storage.local`, not Chrome sync. At most 100 saved books, 200 ISBN histories and 360 observations per ISBN are retained. On updating a book's history, observations older than 90 days for that book are removed. Old histories for unqueried books can remain until replaced by the 200-book bound or deleted.

No analytics, advertising, affiliate tracking, remote code, account system or background monitoring is included. Selected store IDs are also saved locally. Use **Apagar dados** to delete the saved shelf and history and reset store selection. Uninstalling removes extension storage. Optional site permissions can be revoked in Chrome's extension settings.
