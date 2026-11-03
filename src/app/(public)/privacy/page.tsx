import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  const { contact, name } = siteConfig;
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-12">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy notice</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This notice explains how {name} handles personal information of job seekers in the United States and Canada.
        It is a template and must be reviewed by your legal counsel before publication; it does not by itself establish
        compliance with PIPEDA, provincial privacy laws (e.g. Quebec Law 25, Alberta/BC PIPA) or US state privacy laws.
      </p>

      <div className="mt-8 space-y-8 text-[15px] leading-7">
        <section>
          <h2 className="text-lg font-semibold">What we collect</h2>
          <p className="mt-2">
            Contact details, professional background (titles, experience, skills, education, certifications), job preferences,
            expected compensation, availability, a work authorization status, and the resumes and documents you upload.
            We do not ask for immigration documents, government ID numbers, or other sensitive information not needed for recruitment.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">How we use it</h2>
          <p className="mt-2">
            To consider you for roles you apply to or that our recruiters believe match your profile, to communicate with you,
            and — for a specific role — to share your application with the hiring employer after you apply or give consent.
            We do not use automated decision-making to screen or reject candidates.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">How we protect it</h2>
          <p className="mt-2">
            Documents are stored in private storage and are only accessible to authorized staff through time-limited links.
            Staff access is role-based. Data is encrypted in transit.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Retention</h2>
          <p className="mt-2">
            We keep your information while your account is active and for as long as needed for recruitment purposes or to meet
            legal and record-keeping obligations, after which it is deleted or anonymized.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Your choices and rights</h2>
          <p className="mt-2">
            You can view and update your profile at any time. To request access to, correction of, or deletion of your
            information, email{" "}
            <a href={`mailto:${contact.privacyEmail}`} className="underline">{contact.privacyEmail}</a> from the address on your
            account. Some records may need to be retained where the law requires.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="mt-2">
            {name} · {contact.address} · <a href={`mailto:${contact.privacyEmail}`} className="underline">{contact.privacyEmail}</a> · {contact.phone}
          </p>
        </section>
      </div>
    </div>
  );
}
