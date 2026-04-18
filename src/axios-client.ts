import axios from 'axios';

const axiosClient = axios.create({
    // Prioritet ima ENV promenljiva, ako je nema ide na localhost
    baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000',

    // OBAVEZNO: Dozvoljava browseru da prima i šalje kolačiće (session i XSRF)
    withCredentials: true,

    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

/**
 * Robustna helper funkcija za čitanje XSRF tokena iz dokumenta.
 * Budući da Laravelov XSRF-TOKEN nije 'HttpOnly', JS može da ga pročita.
 */
const getXsrfToken = (): string | null => {
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.startsWith("XSRF-TOKEN=")) {
            // Vraćamo dekodiran token (Laravel ga šalje URL-encoded)
            return decodeURIComponent(c.substring("XSRF-TOKEN=".length, c.length));
        }
    }
    return null;
};

// REQUEST INTERCEPTOR: Ručno lepljenje tokena u header pre svakog zahteva
axiosClient.interceptors.request.use((config) => {
    const token = getXsrfToken();

    // Ako šaljemo "state-changing" zahtev, moramo poslati X-XSRF-TOKEN zaglavlje
    if (token && ['post', 'put', 'patch', 'delete'].includes(config.method || '')) {
        config.headers['X-XSRF-TOKEN'] = token;
    }

    return config;
});

// RESPONSE INTERCEPTOR: Obrada grešaka (npr. istekla sesija)
axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            // Ako dobijemo 401 (Unauthenticated), brišemo lokalni status login-a
            if (error.response.status === 401) {
                localStorage.removeItem('USER_LOGGED_IN');
                // Ovde možeš dodati i: window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default axiosClient;
