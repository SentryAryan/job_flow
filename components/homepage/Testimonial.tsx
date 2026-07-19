import Image from "next/image";

export default function Testimonial() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">
          Success Stories
        </span>

        <blockquote className="mt-6 text-2xl font-medium leading-snug text-text-primary">
          &ldquo;I used to spend my evenings copy-pasting resumes. Now I open my
          dashboard to see interviews waiting. It feels like cheating. Had 3
          offers on the table simultaneously.&rdquo;
        </blockquote>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Image
            src="/images/user-icon.png"
            alt="Tom Wilson"
            width={44}
            height={44}
            className="h-11 w-11 rounded-lg object-cover"
          />
          <div className="text-left">
            <div className="text-sm font-semibold text-text-primary">
              Tom Wilson
            </div>
            <div className="text-xs text-text-secondary">Junior Developer</div>
          </div>
        </div>
      </div>
    </section>
  );
}
