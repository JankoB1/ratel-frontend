import {AlignCenter, AlignJustify, AlignLeft, AlignRight, ChevronDown, ChevronUp} from "lucide-react";

const RightSidebar = () => {

    return (
        <aside className="w-[320px] bg-background-grey p-6 flex flex-col gap-8 overflow-y-auto">

            {/* Biblioteka */}
            <section>
                <div className="bg-[#F8FAFC] rounded-[21px] p-4 mb-4">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="h-16 bg-white border rounded border-blue-200"></div>
                        <div className="h-16 bg-white border rounded border-blue-200"></div>
                        <div className="h-16 bg-white border rounded border-blue-200"></div>
                        <div className="h-16 bg-white border rounded border-blue-200"></div>
                    </div>
                </div>
                <div className="w-full bg-white py-4 pl-4 border-[0.5px] border-slate-400 rounded-[21px] text-[14px] font-normal uppercase tracking-widest">библиотека</div>
            </section>

            {/* Grid settings */}
            <section className="space-y-4 bg-white rounded-[21px] p-4">
                <div className="flex justify-between items-center px-2">
                    <span className="text-sm font-normal">Редови</span>
                    <div className="flex items-center bg-[#37495717] rounded-[4px] px-2 py-1 gap-4">
                        <span className="text-sm w-[30px]">5</span>
                        <div className="flex flex-col text-[8px] text-dark-blue">
                            <ChevronUp size={10} />
                            <ChevronDown size={10} />
                        </div>
                    </div>
                </div>
                <div className="flex justify-between items-center px-2">
                    <span className="text-sm font-normal">Колоне</span>
                    <div className="flex items-center bg-[#37495717] rounded-[4px] px-2 py-1 gap-4">
                        <span className="text-sm w-[30px]">6</span>
                        <div className="flex flex-col text-[8px] text-dark-blue">
                            <ChevronUp size={10} />
                            <ChevronDown size={10} />
                        </div>
                    </div>
                </div>
            </section>

            {/* Boja pozadine */}
            <section>
                <h4 className="text-base font-normal text-dark-blue uppercase mb-3">Додај позадину</h4>
                <div className="flex items-center justify-between bg-[#F8FAFC] p-4 rounded-[21px]">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-[#E9F0F9] rounded-md"></div>
                        <span className="text-[14px] font-normal text-dark-blue uppercase">E9F0F9</span>
                    </div>
                    <div className="w-4 h-[2px] bg-slate-300"></div>
                </div>
            </section>

            {/* Tipografija */}
            <section>
                <h4 className="text-base font-normal text-dark-blue uppercase mb-3">Типографија</h4>
                <div className="space-y-4 bg-white rounded-[21px] p-4">
                    <div className="relative">
                        <select className="w-full appearance-none bg-[#F8FAFC] border rounded-xl p-3 text-xs font-semibold text-slate-500 outline-none">
                            <option>Наслов</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3 text-slate-400" size={14} />
                    </div>

                    <div className="bg-[#F8FAFC] border rounded-xl p-2 flex flex-col gap-3">
                        <div className="flex items-center justify-between px-2 py-1">
                            <div className="flex gap-4 text-slate-600">
                                <button className="font-bold">B</button>
                                <button className="italic">I</button>
                                <button className="underline">U</button>
                                <button className="text-xs">Aa</button>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold">16</span>
                                <ChevronDown size={12} />
                            </div>
                        </div>
                        <div className="h-[1px] bg-slate-200 w-full"></div>
                        <div className="flex justify-between px-2 pb-1 text-slate-400">
                            <AlignLeft size={16} />
                            <AlignCenter size={16} />
                            <AlignRight size={16} />
                            <AlignJustify size={16} />
                        </div>
                    </div>
                </div>
            </section>
        </aside>
    )
}

export default RightSidebar;