import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import PanelPage from './pages/PanelPage';

function App() {
    return (
        <Router>
            <div className="min-h-screen bg-gray-100">
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/panel" element={<PanelPage />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;