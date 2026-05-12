import Header from "../components/Header";
import Scan from "../components/Scan";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow flex justify-center px-4">
        <div className="w-full max-w-3xl relative">
          <div className="relative z-20">
            <Scan />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
