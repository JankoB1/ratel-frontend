import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
    const { user, logout } = useAuth();

    return (
        <div style={{ padding: '20px' }}>
            <h1>Dobrodošao, {user?.name}!</h1>
            <p>Ovo je tvoja zaštićena kontrolna tabla.</p>
            <button onClick={logout}>Odjavi se</button>
        </div>
    );
}
