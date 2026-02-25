const ContentList = () => {
    return (
        <div className="w-56 shrink-0 text-dark-blue">
            <ul className="space-y-4 text-[14px] font-bold uppercase tracking-tight">
                <li>1. Увод</li>
                <li>2. Методологија</li>
                <li className="text-[#0056B3]">3. Индекс дигиталне економије</li>
                <ul className="pl-6 mt-4 space-y-3 text-slate-500 font-normal text-[14px]">
                    <li>3.1 Инфраструктура</li>
                    <li>3.2 Употреба интернета</li>
                </ul>
                <li className="pt-2">4. Закључак</li>
            </ul>
        </div>
    );
};

export default ContentList;