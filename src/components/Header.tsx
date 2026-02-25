import {Bell, ChevronDown, Search, ZoomIn, ZoomOut} from "lucide-react";
import logo from '../assets/logo.svg';

const Header = () => {
    return (
        <header className="h-20 px-8 m-8 w-full flex items-center justify-between bg-background-grey">
            <div className="flex items-center gap-4 bg-white rounded-[50px] py-[10px] px-[40px] header-logo">
                <div className="text-[#0056B3] font-bold text-xl flex items-center gap-2">
                    <img src={logo} alt="logo-ratel" />
                    <p className="text-primary-blue font-medium">RATEL</p>
                </div>
                <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
                <div>
                    <h1 className="text-base font-extrabold uppercase">Annual Report 2026</h1>
                    <span className="text-base text-dark-blue flex items-center gap-1 uppercase">
                <span className="w-2 h-2 bg-orange-400 rounded-full"></span> У ИЗРАДИ
              </span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex bg-white rounded-full p-1 py-[20px] px-[35px]">
                    <button className="pr-4 text-base text-slate-500 uppercase">Хедер</button>
                    <div className="w-[1px] bg-dark-blue"></div>
                    <button className="pl-4 text-base text-slate-500 uppercase">Футер</button>
                </div>
                <div className="flex items-center bg-white rounded-[50px] px-[20px] py-[20px] gap-3">
                    <ZoomIn size={20} className="text-dark-blue" />
                    <div className="w-[1px] h-4 bg-dark-blue"></div>
                    <ZoomOut size={20} className="text-slate-300" />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-6 mr-4 bg-white rounded-[50px] py-[20px] px-[35px]">
                    <Search size={20} className="text-dark-blue" />
                    <div className="relative">
                        <Bell size={20} className="text-dark-blue" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    </div>
                </div>
                <div className="flex items-center gap-6 bg-white rounded-[50px] py-[20px] px-[35px]">
                    <img src="https://via.placeholder.com/32" alt="admin" className="w-8 h-8 rounded-full object-cover" />
                    <span className="text-base tracking-wider uppercase mr-8">АДМИН</span>
                    <ChevronDown size={20} />
                </div>
            </div>
        </header>
    )
}

export default Header;