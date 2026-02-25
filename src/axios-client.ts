import axios from 'axios';

const axiosClient = axios.create({
    baseURL: 'http://localhost:8000', // Bez /api ovde, dodajemo ga u pozivima ili promeni ovde u /api
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Helper funkcija za čitanje kolačića (Regex je sigurniji od split-a)
const getCookie = (name: string): string | null => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (match) return match[2];
    return null;
};

// REQUEST INTERCEPTOR
axiosClient.interceptors.request.use((config) => {

    // 1. Pokušaj da nađeš token
    const token = getCookie('XSRF-TOKEN');

    // 2. Ako postoji, dekodiraj ga i ubaci u header
    if (token) {
        config.headers['X-XSRF-TOKEN'] = decodeURIComponent(token);
    }

    return config;
});

// RESPONSE INTERCEPTOR
axiosClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        const { response } = error;
        if (response) {
            if (response.status === 401) {
                localStorage.removeItem('USER_LOGGED_IN');
            }
        }
        throw error;
    }
);

export default axiosClient;
