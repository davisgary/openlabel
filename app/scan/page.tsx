import Header from '../../components/Header';
import Footer from '../../components/Footer';
import Scan from '../../components/Scan';

export const metadata = {
  title: 'Scan — OpenLabel',
  description: 'Use your camera or enter a barcode to get nutrition info about packaged products.',
};

export default function ScanPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="w-full max-w-2xl">
          <Scan />
        </div>
      </main>
      <Footer />
    </div>
  );
}
