import { createContext, useContext, useState } from "react";
import type { ReactNode } from 'react';
import axiosClient from "../axios-client";

interface User {
    id: number;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    login: (payload: any) => Promise<void>;
    logout: () => Promise<void>;
    getUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    login: async () => {},
    logout: async () => {},
    getUser: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);

    // CSRF zaštita - ovo se mora pozvati pre prvog POST zahteva (login/register)
    const csrf = () => axiosClient.get('/sanctum/csrf-cookie');

    const getUser = async () => {
        try {
            const { data } = await axiosClient.get('/api/user');
            setUser(data);
        } catch (e) {
            // Nije ulogovan
            setUser(null);
        }
    };

    const login = async (payload: any) => {
        await csrf(); // 1. Uzmi CSRF token
        await axiosClient.post('/api/login', payload); // 2. Uloguj se
        await getUser(); // 3. Povuci podatke o korisniku
    };

    const logout = async () => {
        await axiosClient.post('/api/logout');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, getUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
