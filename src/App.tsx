import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import PanelPage from './pages/PanelPage';
import { EditorProvider } from "./contexts/EditorContext.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import PrintView from "./pages/PrintView.tsx";
import ViewPage from "./pages/ViewPage.tsx";
import AdminPage from "./pages/AdminPage.tsx";
import LandingPage from "./pages/LandingPage.tsx";
import GroupPreviewPage from "./pages/GroupPreviewPage.tsx";
import InboxPage from "./pages/InboxPage.tsx";
import CollectionPage from "./pages/CollectionPage.tsx";
import QuarterlyPage from "./pages/QuarterlyPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";

function App() {
    return (
        <Router>
            {/* AuthProvider obavija celu aplikaciju kako bi auth state bio dostupan svuda */}
            <AuthProvider>
                <div className="min-h-screen bg-gray-100">
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<LoginPage />} />

                        <Route
                            path="/panel/:docId"
                            element={
                                <EditorProvider>
                                    <PanelPage />
                                </EditorProvider>
                            }
                        />
                        <Route
                            path="/panel"
                            element={
                                <EditorProvider>
                                    <PanelPage />
                                </EditorProvider>
                            }
                        />

                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/inbox" element={<InboxPage />} />
                        <Route path="/group/:id/preview" element={<GroupPreviewPage />} />
                        <Route path="/collection/:id" element={<CollectionPage />} />
                        <Route path="/quarterly" element={<QuarterlyPage />} />
                        <Route path="/document/:id/print" element={<PrintView />} />
                        <Route path="/document/:id/view" element={
                            <EditorProvider>
                                <ViewPage />
                            </EditorProvider>
                        } />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </AuthProvider>
        </Router>
    );
}

export default App;
