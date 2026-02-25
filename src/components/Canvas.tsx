import add from "../assets/apps-add.svg";

const AddBlock = ({ height = "h-48" }) => (
    <div className={`${height} w-full border-1 border-[#248FCF] flex flex-col items-center justify-center bg-white hover:bg-blue-50 transition-colors cursor-pointer group`}>
        <div className="flex flex-col items-center gap-2">
            <img src={add} alt="logo-ratel" width="45" height="45" />
        </div>
    </div>
);

const Canvas = () => {

    return (
        <div className="
                        /* Dimenzije za A4 format (standard na 96 DPI) */
                        w-[794px]
                        min-h-[1123px]

                        /* Centriranje i izgled papira */
                        mx-auto
                        bg-white
                        shadow-[0_0_20px_rgba(0,0,0,0.1)]
                        rounded-none
                        p-[40px]
                        relative
                        border border-slate-200
                        overflow-hidden
                    ">
            <div className="w-[424px] ml-auto pr-8 pb-[10px] mb-[30px] text-right text-[11px] text-primary-blue font-normal uppercase border-b-[0.5px] border-primary-blue">Annual Report 2026</div>


            <div className="mb-8">
                <AddBlock height="h-64" />
            </div>
            <div>
                <AddBlock height="h-64" />
            </div>
        </div>
    );
};

export default Canvas;