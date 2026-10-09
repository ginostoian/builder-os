import type { Metadata } from "next";
import { BlogIndex } from "@/components/marketing/blog-index";
import { NewsletterSignup } from "@/components/marketing/newsletter";
import { Container, H2 } from "@/components/marketing/pieces";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "Blog: guides for UK renovation firms", description: "Practical guides on pricing, cash flow and running a renovation firm, plus what's new in Builder OS.", path: "/blog" });

export default function BlogPage() {
  return (
    <>
      <BlogIndex />
      <section className="px-6 py-28">
        <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-center gap-x-12 gap-y-6 rounded-3xl bg-white p-[clamp(32px,5vw,56px)] shadow-ring">
          <div>
            <H2 className="text-[clamp(24px,2.8vw,32px)] leading-[1.15] tracking-[-0.03em]">One useful email a fortnight.</H2>
            <p className="mt-2.5 text-[15.5px] leading-[1.55] text-ink-2">Pricing tips, templates and the odd war story. No fluff, unsubscribe in one click.</p>
          </div>
          <NewsletterSignup />
        </Container>
      </section>
    </>
  );
}
