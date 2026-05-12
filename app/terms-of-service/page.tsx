import Header from '../../components/Header';
import Footer from '../../components/Footer';

export const metadata = { title: 'Terms of Service — Open Label' };

export default function TermsOfService() {
  return (
    <>
      <main className="max-w-3xl mx-auto p-6 pt-32">
        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>

        <p className="mb-4">
          Welcome to Open Label. By using our platform, you agree to the following terms and conditions. Please read them
          carefully.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-2">1. Introduction</h2>
        <p className="mb-4">
          Open Label provides tools for SEO, language model integration, and website optimization. These terms govern your use
          of our services.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">2. Use of Services</h2>
        <p className="mb-4">
          You agree to use our services only for lawful purposes and in accordance with these Terms. Misuse or abuse of
          the platform may result in termination of access.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">3. Account</h2>
        <p className="mb-4">
          You are responsible for maintaining the confidentiality of your account and agree to accept responsibility for
          all activities that occur under your account.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">4. Changes to Terms</h2>
        <p className="mb-4">
          Open Label may update these Terms from time to time. Continued use of the platform after changes means you accept
          the new terms.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">5. Open Label — Educational Use & Medical Disclaimer</h2>
        <p className="mb-4">
          The Open Label feature is provided for educational, informational, and exploratory purposes only. Results from
          scans, analyses, or any automated suggestions are not intended to be, and must not be relied on, as medical,
          nutritional, dietary, legal, or professional advice. Always consult a qualified professional (for example, a
          licensed medical practitioner, dietitian, or pharmacist) regarding any health-related questions, diagnoses, or
          treatment decisions.
        </p>
        <p className="mb-4">
          If you have a medical condition, are pregnant, nursing, taking medications, or have allergies, do not change or
          stop any medical regimen based on information from Open Label. The company does not warrant the accuracy,
          completeness, or usefulness of any information provided by the scan feature and disclaims liability for any
          decisions made based on scan results.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">6. Limitation of Liability</h2>
        <p className="mb-4">
          TO THE FULLEST EXTENT PERMITTED BY LAW, THE COMPANY, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS,
          AND LICENSORS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
          INCLUDING LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO YOUR
          USE OF, OR INABILITY TO USE, THE Open Label FEATURE, EVEN IF THE COMPANY HAS BEEN ADVISED OF THE POSSIBILITY
          OF SUCH DAMAGES.
        </p>
        <p className="mb-4">
          In no event will the company's aggregate liability for any claim arising out of or relating to these Terms or the
          Open Label feature exceed the amount paid by you to the company in the twelve (12) months preceding the event
          giving rise to liability, or fifty dollars ($50), whichever is greater.
        </p>

        <p className="text-sm text-muted-foreground mt-8">For questions, contact us.</p>
      </main>
      <Footer />
    </>
  );
}
