import CtaButtons from "@/components/homepage/CtaButtons";

const HERO_GRADIENT =
  "radial-gradient(55% 55% at 15% 20%, var(--color-accent-light), transparent 60%)," +
  "radial-gradient(50% 50% at 85% 12%, var(--color-info-light), transparent 55%)," +
  "radial-gradient(45% 50% at 65% 95%, var(--color-accent-muted), transparent 60%)";

export default function Hero() {
  return (
    <section className="pt-6">
      <div
        className="px-6 pb-20 pt-16 text-center"
        style={{ backgroundImage: HERO_GRADIENT }}
      >
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight text-text-darkest sm:text-5xl">
          Job hunting is hard.
          <br />
          Your tools shouldn&apos;t be.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-text-secondary">
          Finding roles, researching companies, and guessing your fit eats up
          hours. JobPilot scores every job against your profile and does the
          research for you — so you just review and apply.
        </p>
        <div className="mt-8 flex justify-center">
          <CtaButtons align="center" />
        </div>
      </div>
    </section>
  );
}
