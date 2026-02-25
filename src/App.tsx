// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Ovu komponentu koristimo da zaštitimo rute
// Ako korisnik nije ulogovan, vraća ga na /login
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    const { user } = useAuth();

    // Ovde bi idealno išao i "loading" spinner dok proveravamo sesiju
    // ali za početak je ovo dovoljno.
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

function App() {
    return (
        <BrowserRouter>
            {/* AuthProvider mora biti unutar Router-a ili oko njega,
          ali pošto koristi axios spolja, ovde je ok da obavija Routes */}
            <AuthProvider>
                <Routes>
                    {/* Javna ruta */}
                    <Route path="/login" element={<Login />} />

                    {/* Zaštićena ruta */}
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App
