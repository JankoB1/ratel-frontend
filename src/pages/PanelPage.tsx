import LeftSidebar from "../components/LeftSidebar.tsx";
import Header from "../components/Header.tsx";
import RightSidebar from "../components/RightSidebar.tsx";
import ContentList from "../components/ContentList.tsx";
import Canvas from "../components/Canvas.tsx";

const PanelPage = () => {
    return (
        <div className="bg-background-grey text-dark-blue font-sans">

            <section className="flex">

            {/* TOP NAVBAR */}
            <Header />
            </section>

            {/* --- CENTRALNI DEO (Editor) --- */}
            <section className="flex mx-8">

                <LeftSidebar />


                {/* EDITOR AREA */}
                <div className="flex-1 flex p-10 gap-10 overflow-y-auto justify-center">
                    {/* Sadržaj / TOC */}
                    <ContentList />

                    {/* Canvas (Beli papir) */}
                    <Canvas />
                </div>

                {/* --- DESNI PANEL (Podešavanja) --- */}
                <RightSidebar />
            </section>


        </div>
    );
};



export default PanelPage;