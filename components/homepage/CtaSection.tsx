import CtaButtons from "@/components/homepage/CtaButtons";

const CTA_GRADIENT =
  "radial-gradient(55% 60% at 20% 20%, var(--color-accent-light), transparent 60%)," +
  "radial-gradient(50% 55% at 80% 20%, var(--color-info-light), transparent 55%)," +
  "radial-gradient(50% 60% at 55% 100%, var(--color-accent-muted), transparent 60%)";

export default function CtaSection() {
  return (
    <section>
      <div
        className="px-6 py-20 text-center"
        style={{ backgroundImage: CTA_GRADIENT }}
      >
        <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-tight text-text-darkest sm:text-4xl">
          Your next job search can feel a lot less overwhelming
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-text-secondary">
          Set up your profile once, upload your resume, and start finding jobs
          that fit in minutes.
        </p>
        <div className="mt-8 flex justify-center">
          <CtaButtons align="center" />
        </div>
      </div>
    </section>
  );
}
