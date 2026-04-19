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

    const getUser = async () => {
        // Ako nema tokena, nema potrebe da pingujemo server
        const token = localStorage.getItem('ACCESS_TOKEN');
        if (!token) {
            setUser(null);
            return;
        }

        try {
            const { data } = await axiosClient.get('/api/user');
            setUser(data);
        } catch (e) {
            setUser(null);
            localStorage.removeItem('ACCESS_TOKEN');
        }
    };

    const login = async (payload: any) => {
        // Više ne zovemo csrf-cookie rutu!
        const { data } = await axiosClient.post('/api/login', payload);

        // 1. Čuvamo token
        localStorage.setItem('ACCESS_TOKEN', data.token);

        // 2. Setujemo korisnika direktno iz login responsa (štedimo jedan API poziv)
        setUser(data.user);
    };

    const logout = async () => {
        try {
            await axiosClient.post('/api/logout');
        } catch (error) {
            console.error(error);
        } finally {
            // Bez obzira šta kaže server, mi lokalno brišemo sesiju
            localStorage.removeItem('ACCESS_TOKEN');
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, getUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
