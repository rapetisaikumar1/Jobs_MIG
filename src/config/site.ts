export const siteConfig = {
  name: "MaverickInnogarage",
  shortName: "MIG",
  tagline: "IT talent for teams across the United States and Canada",
  description:
    "MaverickInnogarage connects experienced IT professionals with technology roles across the United States and Canada.",
  contact: {
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "careers@maverickinnogarage.com",
    privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "privacy@maverickinnogarage.com",
    phone: process.env.NEXT_PUBLIC_CONTACT_PHONE ?? "+1 (416) 555-0100",
    address: process.env.NEXT_PUBLIC_CONTACT_ADDRESS ?? "Toronto, Ontario, Canada",
  },
  logo: { src: "/brand/mig-logo.svg", width: 180, height: 80 },
  mark: { src: "/brand/mig-mark.svg", width: 180, height: 58 },
};
