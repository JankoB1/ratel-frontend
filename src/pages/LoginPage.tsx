import ratelLogo from '../assets/logo-tekst.svg';
import background from '../assets/background-login.png';
import {useState} from "react";
import {Eye, EyeOff} from "lucide-react";

const LoginPage = () => {

    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        setError("");

        if (!email.trim() || !password.trim()) {
            setError("Попуните сва поља како бисте се пријавили.");
            return;
        }

        if (!email.includes("@")) {
            setError("Унесите исправну е-маил адресу.");
            return;
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col bg-no-repeat bg-cover bg-bottom items-center p-8 login" style={{ backgroundImage: `url(${background})` }}>
            <div className="w-full max-w-md text-center">
                <img src={ratelLogo} alt="ratel" className="mb-28 w-100" />
                <form className="space-y-4" onSubmit={handleLogin}>
                    {error && (
                        <p className="text-red-500 text-sm font-medium animate-bounce">
                            {error}
                        </p>
                    )}
                    <div>
                        <input
                            type="email"
                            placeholder="мејл"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`w-full h-[60px] px-6 border-[1px] rounded-[50px] outline-none transition-all ${
                                error && !email ? "border-red-500" : "border-primary-blue"
                            }`}
                        />
                    </div>
                    <div className="relative flex items-center">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="лозинка"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`w-full h-[60px] pl-6 pr-14 border-[1px] rounded-[50px] outline-none transition-all ${
                                error && !password ? "border-red-500" : "border-primary-blue"
                            }`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-6 text-gray-400 hover:text-primary-blue transition-colors bottom-4"
                        >
                            {showPassword ? (
                                <EyeOff size={24} strokeWidth={1.5} />
                            ) : (
                                <Eye size={24} strokeWidth={1.5} />
                            )}
                        </button>
                    </div>
                    <div className="flex items-end justify-end w-full">
                        <button
                            type="button"
                            className="pr-4 text-base hover:text-primary-blue transition-colors cursor-pointer"
                        >
                            Заборавили сте лозинку?
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-[20px] text-sm text-center font-medium animate-pulse">
                            {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        className="w-full h-[60px] bg-primary-blue text-white font-semibold rounded-[50px] hover:bg-opacity-90 transition-colors mt-4"
                    >
                        Пријави се
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;