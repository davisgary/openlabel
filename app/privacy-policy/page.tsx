import Header from '../../components/Header';
import Footer from '../../components/Footer';

export const metadata = {
  title: 'Privacy Policy — Open Label',
};

export default function PrivacyPolicy() {
  return (
    <>
      <main className="max-w-3xl mx-auto p-6 pt-32">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

        <p className="mb-4">
          Your privacy is important to us at Open Label. This policy explains how we collect, use, and protect your
          information when you use our platform.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">1. Information We Collect</h2>
        <p className="mb-4">
          We collect information you provide directly (for example, account signup details such as name and email) and
          information generated when you use Open Label. Open Label-specific data may include images you upload, photos
          of product packaging, barcodes/UPC codes, product names, ingredient lists or nutrition labels you submit or scan,
          and any text or responses produced by the scan feature.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">2. How We Use Information</h2>
        <p className="mb-4">
          We use collected data to operate, maintain, and improve Open Label. This includes analyzing product data to
          generate educational information, powering machine learning models, improving accuracy of scans, and providing
          personalized features. We may also use your contact information to send administrative messages and updates.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">3. Third-Party Services & Model Providers</h2>
        <p className="mb-4">
          Open Label may transmit scan data to third-party service providers for processing (for example, OCR services,
          analytics providers, or language models). These providers process data on our behalf under contract and are
          only permitted to use it for the purposes we specify. If we use external AI providers to analyze or summarize
          product information, those requests may include the scanned text or images.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">4. Data Retention, Aggregation & Anonymization</h2>
        <p className="mb-4">
          We retain scan data as needed to provide the service, comply with legal obligations, resolve disputes, and
          improve our models. Where possible we aggregate and anonymize data to remove identifiers before using it for
          analytics or model training. You can request deletion of your personal account and associated personal data by
          contacting us; aggregated or anonymized data used for analytics may be retained.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">5. Security</h2>
        <p className="mb-4">
          We implement reasonable administrative, technical, and physical safeguards to protect your information. However,
          no system is completely secure; we cannot guarantee the absolute security of any data you transmit to us.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">6. Your Choices and Controls</h2>
        <p className="mb-4">
          You may access, correct, or delete your personal information through your account settings or by contacting us.
          You may also opt out of certain data uses (such as personalized product recommendations) where applicable. If
          you remove images or scan data from your account, copies may persist in backups or aggregated datasets for a
          limited time.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">7. Changes to This Policy</h2>
        <p className="mb-4">
          We may update this Privacy Policy to reflect changes in our practices or legal requirements. We will post the
          updated policy on this page and, where appropriate, provide notice of significant changes.
        </p>

        <p className="text-sm text-muted-foreground mt-8">For questions, contact us.</p>
      </main>
      <Footer />
    </>
  );
}
