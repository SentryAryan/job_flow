import Confidence from "@/components/homepage/Confidence";
import CtaSection from "@/components/homepage/CtaSection";
import DashboardPreview from "@/components/homepage/DashboardPreview";
import Features from "@/components/homepage/Features";
import Hero from "@/components/homepage/Hero";
import SectionDivider from "@/components/homepage/SectionDivider";
import Testimonial from "@/components/homepage/Testimonial";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl border-x border-border bg-surface">
          <Hero />
          <section className="border-t border-border bg-surface-muted px-6 py-14 sm:px-10">
            <DashboardPreview />
          </section>
          <Features />
          <SectionDivider />
          <Confidence />
          <SectionDivider />
          <Testimonial />
          <SectionDivider />
          <CtaSection />
          <SectionDivider />
        </div>
      </main>
      <Footer />
    </>
  );
}
