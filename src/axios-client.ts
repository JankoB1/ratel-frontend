import axios from 'axios';

const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_URL || 'https://rat.exalt.rs',
    // withCredentials nam VIŠE NE TREBA jer ne koristimo kolačiće!
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// REQUEST INTERCEPTOR: Ručno lepljenje tokena iz localStorage-a
axiosClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('ACCESS_TOKEN');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// RESPONSE INTERCEPTOR: Obrada grešaka (brisanje tokena ako je istekao/nevažeći)
axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            // Ako dobijemo 401 (Unauthenticated), brišemo token
            if (error.response.status === 401) {
                localStorage.removeItem('ACCESS_TOKEN');
            }
        }
        return Promise.reject(error);
    }
);

export default axiosClient;
