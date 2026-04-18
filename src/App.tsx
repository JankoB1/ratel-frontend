import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import PanelPage from './pages/PanelPage';
import { EditorProvider } from "./contexts/EditorContext.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import PrintView from "./pages/PrintView.tsx"; // Dodaj ovaj import!

function App() {
    return (
        <Router>
            {/* AuthProvider obavija celu aplikaciju kako bi auth state bio dostupan svuda */}
            <AuthProvider>
                <div className="min-h-screen bg-gray-100">
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />

                        <Route
                            path="/panel"
                            element={
                                <EditorProvider>
                                    <PanelPage />
                                </EditorProvider>
                            }
                        />

                        <Route path="*" element={<Navigate to="/login" replace />} />
                        <Route path="/document/:id/print" element={<PrintView />} />
                    </Routes>
                </div>
            </AuthProvider>
        </Router>
    );
}

export default App;
