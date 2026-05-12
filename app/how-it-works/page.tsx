import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';
import Accordion from '../../components/Accordion';

type FAQItem = { question: string; answer: string };

export const metadata = {
  title: 'How it works — Open Label',
  description: 'Learn how Open Label works: how to scan products, what the results mean, and FAQs.',
};

export default function HowItWorks() {
  const faq = [
    {
      question: 'How do I start a scan?',
      answer:
        "Open the Scan page, allow camera access when prompted, and press the Start Scanning button. The app analyzes the image and returns results in seconds when a barcode is in view.",
    },
    {
      question: 'How does it rank the product?',
      answer:
        "We use a combination of factors to rank products, including ingredient quality, nutritional value, and our custom system. So, please check the results on your own. The ingredients and what's in products is very important. So, everything is for informational purposes only and should not be taken as medical advice. We are not responsible for any results provided by the app.",
    },
    {
      question: 'What kinds of products can I scan?',
      answer:
        "You can scan packaged food and beverages that display an ingredient list or barcode. Results are more accurate when the label is clear and well-lit.",
    },
  ];

  const faqJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
  });

  return (
    <>
      <div className="flex flex-col min-h-screen">
        <main className="flex-grow px-4 py-14">
          <div className="mx-auto w-full max-w-3xl">
            <div className="bg-card p-6 sm:p-8 rounded-lg border border-muted dark:border-muted/30">
              <div className="prose prose-slate dark:prose-invert text-sm text-primary-foreground">
                <h1 className="text-2xl font-bold text-primary-foreground">How Open Label works</h1>

                <p>
                  Open Label helps you quickly understand what's in packaged foods and
                  beverages. Below you'll find a short overview of the process and some
                  practical tips for best results.
                </p>

                <h2 className="mt-6 text-lg font-semibold text-primary-foreground">Step-by-step</h2>
                <ol className="list-decimal pl-6 space-y-3">
                  <li>
                    <strong>Open the Scan tool:</strong> Go to the Scan page in to access the barcode scanner and lookup tool.
                  </li>
                  <li>
                    <strong>Capture an image:</strong> Start the scanner by clicking the Start Scanning button. Then point your camera at the product
                    label or barcode and take a clear photo. Good lighting and steady
                    hands improve accuracy. It should detect when a barcode is in view and take it automativally for you.
                  </li>
                  <li>
                    <strong>Barcode lookup:</strong> Find the barcode number on your product's packaging
                    and enter the numbers it displays. You usually want to include the smaller numbers to the left and right as well.
                    Then it will find the product just as if you took a picture of the barcode.
                  </li>
                  <li>
                    <strong>Analyze:</strong> The app then extracts the ingredient list and
                    runs it through our matching and scoring logic to highlight
                    ingredients of interest.
                  </li>
                  <li>
                    <strong>Review results:</strong> Results show detected nutrients,
                    flagged additives, preservatives, or allergens, 
                    and a simple score to help you decide quickly.
                  </li>
                  <li>
                    <strong>Further Knowledge with AI:</strong> You can then after you receive your results
                    on the product ask our tailored AI with questions regarding the product and ingredients
                    inside it. 
                    <span className="block italic mt-1">*Pro tip: You can click on an additive, preservative, or allergen to learn more
                    about it from the AI as well.</span>
                  </li>
                </ol>

                <h2 className="mt-6 text-lg font-semibold text-primary-foreground">What the results mean</h2>
                <p>
                  Each scan returns a breakdown of ingredients and nutrients. We flag any
                  additives, preservatives, or allergens, and provide short explanations and dedicated AI linked to your related
                  product so you can learn more about the product or any item of concern by clicking on it.
                </p>

                <h2 className="mt-6 text-lg font-semibold text-primary-foreground">Tips for best scans</h2>
                <ul className="list-disc pl-6 pb-4 space-y-1">
                  <li>Avoid glare and shadows on the label.</li>
                  <li>Make sure the barcode is fully visible in the photo.</li>
                  <li>Hold the camera steady about 6 inches away from the barcode for the best results.</li>
                  <li>Use a device with a high-resolution camera for packaged products with smaller print.</li>
                  <li>If you use the barcode lookup, include the smaller numbers to the left and right as well.</li>
                </ul>

                <h2 className="font-bold mt-6 text-lg text-primary-foreground">Frequently asked questions</h2>
                <div className="space-y-2">
                  <Accordion items={faq} />
                </div>

                <p className="mt-8 text-sm">If you have additional questions or want to suggest improvements, please contact us.</p>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>

      {/* JSON-LD for FAQ; keep synchronized with visible FAQ content */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
    </>
  );
}
