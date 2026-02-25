import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login({ email, password });
            navigate("/"); // Preusmeri na dashboard
        } catch (e: any) {
            if (e.response && e.response.status === 422) {
                setError("Proverite podatke.");
            } else {
                setError("Došlo je do greške.");
            }
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {error && <div style={{color: 'red'}}>{error}</div>}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
            <button type="submit">Login</button>
        </form>
    );
}
