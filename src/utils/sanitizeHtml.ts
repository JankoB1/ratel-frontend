import DOMPurify from "dompurify";

// Centralno čišćenje HTML-a pre nego što se ubaci preko `dangerouslySetInnerHTML`.
// Rich-text sadržaj (canvas_data) čuva editor kao sirov innerHTML; bez sanitizacije bi
// zlonamerni sadržaj (npr. <img onerror=...>, <script>, <svg onload=...>) izvršio kod u
// pregledaču čitalaca portala i u headless Chrome-u tokom generisanja PDF-a (stored XSS).
//
// DOMPurify podrazumevano zadržava standardno formatiranje (b/i/u/strong/em/a/ul/ol/li/
// sup/sub/span/p/br/tabele...), `class`, `style` i `data-*` atribute — što nam treba za
// fusnote i stilove — a uklanja <script>, event-handler atribute (on*) i opasne URL šeme.
export function sanitizeHtml(dirty: string): string {
    return DOMPurify.sanitize(dirty ?? "", {
        // Linkovi otvoreni iz sadržaja ne smeju da nose reference na originalni tab.
        ADD_ATTR: ["target"],
    });
}
